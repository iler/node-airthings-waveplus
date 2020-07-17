const adapter = require('./adapter.js');
const WavePlus = require('./waveplus.js');

module.exports = new WavePlus(adapter);
