'use strict';

const Homey = require('homey');
const inspector = require('inspector'); // eslint-disable-line

class NeatoApp extends Homey.App {

  onInit() {
    this.debug = false;
    // Start inspector if we are in debug env
    if (process.env.DEBUG) {
      inspector.open(9229, '0.0.0.0', false);
      this.debug = true;
    }

    this.log('Neato Robotics app is running');
  }

}

module.exports = NeatoApp;
