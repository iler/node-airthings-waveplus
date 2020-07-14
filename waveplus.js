const noble = require('@abandonware/noble');
const EventEmitter = require('events').EventEmitter;
const struct = require('python-struct');

class WavePlusDevice extends EventEmitter {
  constructor (data) {
    super();
    this.id = data.id;
    this.serialNumber = data.serialNumber;
    this.address = data.address;
    this.connectable = data.connectable;
  }
}

class WavePlus extends EventEmitter {
  constructor () {
    super();
    this.uuid = ['b42e2a68ade711e489d3123b93f75cba'];
    this._foundDevices = []; // this array will contain registered Wave Plus devices
    this._deviceLookup = {};
    this._readingLookup = {};
    this._readingTimeout = {};
    this.sensorData = [];

    const registerDevice = device => {
      this._foundDevices.push(device);
      this._deviceLookup[device.id] = device;
    };

    const onDiscover = peripheral => {
      let newWavePlus;

      const manufacturerData = peripheral.advertisement ? peripheral.advertisement.manufacturerData : undefined;
      if (manufacturerData) {
        const deviceInfo = struct.unpack('<HLH', manufacturerData);
        if (deviceInfo[0] === 0x0334) {
          if (!this._deviceLookup[peripheral.id]) {
            newWavePlus = new WavePlusDevice({
              id: peripheral.id,
              serialNumber: deviceInfo[1],
              address: peripheral.address,
              connectable: peripheral.connectable
            });
            registerDevice(newWavePlus);
            this.emit('found', newWavePlus);
          }
        }
      }

      // Check if it is an advertisement by an already found Wave Plus device, emit "updated" event
      const wavePlus = this._deviceLookup[peripheral.id];

      if (wavePlus) {
        if (this._readingLookup[peripheral.id]) {
          return;
        }
        this._readingTimeout[peripheral._id] = setTimeout(() => {
          if (this._readingLookup[peripheral._id]) {
            disconnect(wavePlus, peripheral);
          }
        }, 60 * 1000);
        this._readingLookup[peripheral.id] = true;

        connect(this, peripheral);
      }
    };

    noble.on('discover', onDiscover);

    // start scanning
    if (noble.state === 'poweredOn') {
      noble.startScanning([], true);
    } else {
      noble.once('stateChange', () => {
        noble.startScanning([], true);
      });
    }
  }
}

module.exports = new WavePlus();

function connect (wavePlus, peripheral) {
  peripheral.connect((error) => {
    if (error) {
      throw new Error(error);
    }
    const serviceUUIDs = [];
    const characteristicUUIDs = wavePlus.uuid;
    peripheral.discoverSomeServicesAndCharacteristics(serviceUUIDs, characteristicUUIDs, (error, _services, characteristics) => {
      if (error) {
        throw new Error(error);
      }
      characteristics[0].read((error, data) => {
        if (error) {
          throw new Error(error);
        }
        const rawData = struct.unpack('BBBBHHHHHHHH', data);

        const { rssi } = peripheral;

        const humidity = rawData[1] / 2.0;
        const radonStAvg = rawData[4];
        const radonLtAvg = rawData[5];
        const temperature = rawData[6] / 100.0;
        const pressure = rawData[7] / 50.0;
        const co2 = rawData[8] * 1.0;
        const voc = rawData[9] * 1.0;

        wavePlus.emit('updated', {
          rssi,
          humidity,
          temperature,
          pressure,
          co2,
          voc,
          radonLtAvg,
          radonStAvg
        });
        disconnect(this, peripheral);
      });
    });
  });
}

function disconnect (wavePlus, peripheral) {
  clearTimeout(wavePlus._readingTimeout[peripheral._id]);
  wavePlus._readingLookup[peripheral.id] = null;

  peripheral.disconnect(function (error) {
    if (error) {
      throw new Error(error);
    }
  });
}