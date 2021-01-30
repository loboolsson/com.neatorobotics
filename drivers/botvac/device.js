'use strict';

const Homey = require('homey');
const BotvacLibrary = require('../../lib/Botvac');

class BotvacDevice extends Homey.Device {

  botvacLibrary={};

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
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

    this.log('BotvacDevice has been initialized');
    this.log('Name:', this.getName());
    this.log('Class:', this.getClass());
    this.log('id:', this.getAppId());
    this.log('state:', this.getState());
    this.log('settings:', this.getSettings());
    this.log('data:', this.getData());
    // this.log('object:', this);
    // Set current status on device
    await this.setDeviceState();
    // register a capability listener
    this.registerCapabilityListener(
      'vacuumcleaner_state',
      this.onVacuumcleanerState.bind(this),
    );
  }

  async setDeviceState() {
    this.log('set Status');
    const data = this.getData();
    const robot = await this.botvacLibrary.getRobot(data.id);
    this.log(robot);
    this.setCapabilityValue('onoff', true).catch(this.error);
    this.setCapabilityValue('vacuumcleaner_state', 'docked').catch(this.error);
  }

  // this method is called when the Device has requested a state change (turned on or off)
  async onVacuumcleanerState(value, opts) {
    this.log('onVacuumcleanerState');
    this.log('value', value);
    this.log('opts', opts);
    // ... set value to real device, e.g.
    // await setMyDeviceState({ on: value });
    // or, throw an error
    // throw new Error('Switching the device failed!');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('BotvacDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('BotvacDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('BotvacDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('BotvacDevice has been deleted');
  }

  // getState() {
  //   const baseState = super.getState();
  //   baseState.vacuumcleaner_state = 'cleaning';
  //   // baseState.onoff = false;
  //
  //   return baseState;
  // }

}

module.exports = BotvacDevice;
