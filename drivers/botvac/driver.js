'use strict';

const Homey = require('homey');
const BotvacLibrary = require('../../lib/Botvac');

class BotvacDriver extends Homey.Driver {

  botvacLibrary={};

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
    // Init BotvacLibrary
    try {
      this.botvacLibrary = new BotvacLibrary(
        this.homey.settings.get('username'),
        this.homey.settings.get('password'),
        this.log,
      );
    } catch (error) {
      this.log('Botvac initiated with error', error);
    }
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    this.log('Listing devices');
    const robots = await this.botvacLibrary.getAllRobots();
    const listDevices = [];

    this.log('list devices', listDevices);

    for (const robot of robots) {
      listDevices.push(
        {
          name: robot.name,
          data: {
            id: robot._serial,
          },
        },
      );
      this.log('list devices', listDevices);
    }

    return listDevices;
  }

}

module.exports = BotvacDriver;
