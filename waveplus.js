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
  constructor (serialNumber) {
    super();
    this.sn = serialNumber;
    this.uuid = ['b42e2a68ade711e489d3123b93f75cba'];
    this._foundDevices = []; // this array will contain registered Wave Plus devices
    this._deviceLookup = {};
    this._readingLookup = {};
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
        if (deviceInfo[0] === 0x0334 && deviceInfo[1] === this.sn) {
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
        this._readingLookup[peripheral.id] = true;

        peripheral.connect((error) => {
          if (error) {
            throw new Error(error);
          }
          const serviceUUIDs = [];
          const characteristicUUIDs = this.uuid;
          peripheral.discoverSomeServicesAndCharacteristics(serviceUUIDs, characteristicUUIDs, (error, _services, characteristics) => {
            if (error) {
              throw new Error(error);
            }
            characteristics[0].read((error, data) => {
              if (error) {
                throw new Error(error);
              }
              const rawData = struct.unpack('BBBBHHHHHHHH', data);
              const SENSOR_IDX_HUMIDITY = 0;
              const SENSOR_IDX_RADON_SHORT_TERM_AVG = 1;
              const SENSOR_IDX_RADON_LONG_TERM_AVG = 2;
              const SENSOR_IDX_TEMPERATURE = 3;
              const SENSOR_IDX_REL_ATM_PRESSURE = 4;
              const SENSOR_IDX_CO2_LVL = 5;
              const SENSOR_IDX_VOC_LVL = 6;

              this.sensorData[SENSOR_IDX_HUMIDITY] = rawData[1] / 2.0;
              this.sensorData[SENSOR_IDX_RADON_SHORT_TERM_AVG] = rawData[4];
              this.sensorData[SENSOR_IDX_RADON_LONG_TERM_AVG] = rawData[5];
              this.sensorData[SENSOR_IDX_TEMPERATURE] = rawData[6] / 100.0;
              this.sensorData[SENSOR_IDX_REL_ATM_PRESSURE] = rawData[7] / 50.0;
              this.sensorData[SENSOR_IDX_CO2_LVL] = rawData[8] * 1.0;
              this.sensorData[SENSOR_IDX_VOC_LVL] = rawData[9] * 1.0;

              wavePlus.emit('updated', {
                rssi: peripheral.rssi,
                humidity: this.sensorData[SENSOR_IDX_HUMIDITY],
                temperature: this.sensorData[SENSOR_IDX_TEMPERATURE],
                pressure: this.sensorData[SENSOR_IDX_REL_ATM_PRESSURE],
                co2: this.sensorData[SENSOR_IDX_CO2_LVL],
                voc: this.sensorData[SENSOR_IDX_VOC_LVL],
                radonLtAvg: this.sensorData[SENSOR_IDX_RADON_LONG_TERM_AVG],
                radonStAvg: this.sensorData[SENSOR_IDX_RADON_SHORT_TERM_AVG]
              });
              peripheral.disconnect((error) => {
                if (error) {
                  throw new Error(error);
                }

                this._readingLookup[peripheral.id] = null;
              });
            });
          });
        });
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
