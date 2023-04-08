'use strict';

const Homey = require('homey');
const inspector = require('inspector'); // eslint-disable-line

class NeatoApp extends Homey.App {

  onInit() {
    // Start debuger
    if (process.env.DEBUG) {
      inspector.open(9229, '0.0.0.0', false);
    }

    this.log('Neato Robotics app is running');
  }

}

module.exports = NeatoApp;
