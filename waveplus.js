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
  constructor (adapter) {
    super();
    this.uuid = ['b42e2a68ade711e489d3123b93f75cba'];
    this._adapter = adapter;
    this._foundDevices = []; // this array will contain registered Wave Plus devices
    this._deviceLookup = {};
    this._readingLookup = {};
    this._readingTimeout = {};
    this.sensorData = [];

    const registerDevice = device => {
      this._foundDevices.push(device);
      this._deviceLookup[device.id] = device;
    };

    this._adapter.on('warning', warning => {
      console.error(new Error(warning));
    });

    this._adapter.on('discover', peripheral => {
      let newDevice;

      const manufacturerData = peripheral.advertisement ? peripheral.advertisement.manufacturerData : undefined;
      if (manufacturerData) {
        const deviceInfo = struct.unpack('<HLH', manufacturerData);
        if (deviceInfo[0] === 0x0334) {
          if (!this._deviceLookup[peripheral.id]) {
            newDevice = new WavePlusDevice({
              id: peripheral.id,
              serialNumber: deviceInfo[1],
              address: peripheral.address,
              connectable: peripheral.connectable
            });
            registerDevice(newDevice);
            this.emit('found', newDevice);
          }
        }
      }

      // Check if it is an advertisement by an already found Wave Plus device, emit "updated" event
      const device = this._deviceLookup[peripheral.id];

      if (device) {
        if (this._readingLookup[peripheral.id]) {
          return;
        }
        this._readingTimeout[peripheral._id] = setTimeout(() => {
          if (this._readingLookup[peripheral._id]) {
            disconnect(device, peripheral);
          }
        }, 60 * 1000);
        this._readingLookup[peripheral.id] = true;

        connect(this, device, peripheral);
      }
    });
  }
}

module.exports = WavePlus;

function connect (wavePlus, device, peripheral) {
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

        device.emit('updated', {
          rssi,
          humidity,
          temperature,
          pressure,
          co2,
          voc,
          radonLtAvg,
          radonStAvg
        });
        disconnect(wavePlus, peripheral);
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
