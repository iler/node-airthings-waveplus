# node-airthings-waveplus
Node.js module for reading data from a [Airthings Wave Plus](https://www.airthings.com/wave-plus)
indoor air quality monitor.

Tested on Raspberry Pi 3. Depends on [noble](https://github.com/abandonware/noble). See [instructions](https://github.com/abandonware/noble) on
 how to enable BLE on RasPi and how to run without root.

### Installation

```
npm install airthings-waveplus
```


### Usage example


### Events

Module ```wavePlus``` emits a ```found``` event, when a new Wave Plus device
is discovered. Event's payload is a ```wavePlus``` object (see below)

### API

### ```wavePlus``` object

Is an ```eventEmitter``` .

**Properties:**

* ```id```: id of beacon
* ```address```: address of beacon
* ```serialNumber```: serial number of device
* ```connectable```: flag if beacon is connectable

**Events:**

```updated```: emitted when air quality data is received.
Object ```data``` has following properties:

* ```rssi```
* ```humidity```
* ```temperature```
* ```pressure```
* ```co2```
* ```voc```
* ```radonLtAvg```
* ```radonStAvg```

Kudos for inspiration and example to [pakastin](https://github.com/pakastin/node-ruuvitag/)!
