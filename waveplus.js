const noble = require("@abandonware/noble");
const EventEmitter = require("events").EventEmitter;
const struct = require('python-struct');

class WavePlusDevice extends EventEmitter {
  constructor(data) {
    super();
    this.id = data.id;
    this.serialNumber = data.serialNumber;
    this.address = data.address;
    this.connectable = data.connectable;
  }
}

class WavePlus extends EventEmitter {
  constructor(serialNumber) {
    super();
    this.sn = serialNumber;
    this.uuid = ['b42e2a68ade711e489d3123b93f75cba'];
    this._foundDevices = []; // this array will contain registered Wave Plus devices
    this._deviceLookup = {};
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
              connectable: peripheral.connectable,
            });
            registerDevice(newWavePlus);
            this.emit("found", newWavePlus);
          }
        }
      }

      // Check if it is an advertisement by an already found Wave Plus device, emit "updated" event
      const wavePlus = this._deviceLookup[peripheral.id];

      if (wavePlus) {
        peripheral.connect((error) => {
          var serviceUUIDs = [];
          var characteristicUUIDs = this.uuid;
          peripheral.discoverSomeServicesAndCharacteristics(serviceUUIDs, characteristicUUIDs, (_error, _services, characteristics) => {
            characteristics[0].read((_error, data) => {
              const rawData = struct.unpack('BBBBHHHHHHHH', data);
              const SENSOR_IDX_HUMIDITY = 0;
              const SENSOR_IDX_RADON_SHORT_TERM_AVG = 1;
              const SENSOR_IDX_RADON_LONG_TERM_AVG = 2;
              const SENSOR_IDX_TEMPERATURE = 3;
              const SENSOR_IDX_REL_ATM_PRESSURE = 4;
              const SENSOR_IDX_CO2_LVL = 5;
              const SENSOR_IDX_VOC_LVL = 6;

              this.sensorData[SENSOR_IDX_HUMIDITY] = rawData[1]/2.0;
              this.sensorData[SENSOR_IDX_RADON_SHORT_TERM_AVG] = rawData[4];
              this.sensorData[SENSOR_IDX_RADON_LONG_TERM_AVG] = rawData[5];
              this.sensorData[SENSOR_IDX_TEMPERATURE] = rawData[6]/100.0;
              this.sensorData[SENSOR_IDX_REL_ATM_PRESSURE] = rawData[7]/50.0;
              this.sensorData[SENSOR_IDX_CO2_LVL] = rawData[8]*1.0;
              this.sensorData[SENSOR_IDX_VOC_LVL] = rawData[9]*1.0;

              wavePlus.emit("updated", {
                rssi: peripheral.rssi,
                humidity: this.sensorData[SENSOR_IDX_HUMIDITY],
                temperature: this.sensorData[SENSOR_IDX_TEMPERATURE],
                pressure: this.sensorData[SENSOR_IDX_REL_ATM_PRESSURE],
                co2: this.sensorData[SENSOR_IDX_CO2_LVL],
                vo2: this.sensorData[SENSOR_IDX_VOC_LVL],
                radonLtAvg: this.sensorData[SENSOR_IDX_RADON_LONG_TERM_AVG],
                radonStAvg: this.sensorData[SENSOR_IDX_RADON_SHORT_TERM_AVG],
              });
            });
          });
          peripheral.disconnect(function(error) {
            console.log('Disconnected from peripheral: ' + peripheral.uuid);
         });
        });
      };
    };

    noble.on("discover", onDiscover);

    // start scanning
    if (noble.state === "poweredOn") {
      noble.startScanning([], true);
    } else {
      noble.once("stateChange", () => {
        noble.startScanning([], true);
      });
    }
  }
}

module.exports = new WavePlus();