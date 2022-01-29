'use strict';

const Homey = require('homey');
const BotvacLibrary = require('../../lib/Botvac');

class BotVacDriver extends Homey.Driver { 

  robots = [];

  onPair( socket ) {
    let username = '';
    let password = '';
    
    socket.on('login', ( data, callback ) => {
        username = data.username;
        password = data.password;
        
        try {
          this.BotvacLibrary = new BotvacLibrary(username, password, this.log)
        } catch(err){
          callback(err);
        };

        //Check if we can get the list of devices. If not assume credentials are invalid
        this.BotvacLibrary.getAllRobots()
          .then(robots => {
            this.robots = robots;
            callback( null, true );
          })
          .catch(err => {
            callback(err);
          });
    });
    
    socket.on('list_devices', ( data, callback ) => {
      const pairingDevices = this.robots.map(robot =>{
        return {
          name: robot.name,
          data: {
            id: robot._serial,
          },
          store: {
            secret: robot._secret,
          },
        }
      });
      callback( null, pairingDevices );
    });
  }
}

module.exports = BotVacDriver;
2