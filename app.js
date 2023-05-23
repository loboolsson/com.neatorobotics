'use strict';

const Homey = require('homey');
const inspector = require('inspector'); // eslint-disable-line

class NeatoApp extends Homey.App {

  onInit() {
    this.log('Neato Robotics app is starting');
    // Start inspector if we are in debug env
    if (process.env.DEBUG) {
      inspector.open(9229, '0.0.0.0', false);
      this.homey.settings.set('debug', true);
      this.log('Neato Robotics app is in debug mode');
    }
  }

}

module.exports = NeatoApp;
