'use strict';

const Homey = require('homey');
const NeatoApi = require('../../lib/NeatoApi');

class BotVacDriver extends Homey.Driver {

  async onInit() {
    this.neatoApi = new NeatoApi();
  }

  onPair(socket) {

    let apiUrl = this.neatoApi.getOAuth2AuthorizationUrl();
    let neatoOAuthCallback = new Homey.CloudOAuth2Callback(apiUrl)

    neatoOAuthCallback
     .on('url', url => {
         socket.emit('url', url);
     })
     .on('code', async code => {
         let tokensObject = await this.neatoApi.exchangeCode(code);
         this.neatoApi.setToken(tokensObject);
         socket.emit('authorized');
     })
     .generate()
     .catch( err => {
         socket.emit('error', err);
     });

    socket.on('list_devices', async (data, callback) => {
      let pairingDevices = [];
      let robots = await this.neatoApi.getRobots();

      for(let i = 0; i < robots.length; i++) {
        let robot = robots[i];

        pairingDevices.push({
          name: robot.name,
          data: {
            id: robot._serial,
          },
          store: {
            secret: robot._secret,
          },
        });
      }

      callback(null, pairingDevices);
    });
  }
}

module.exports = BotVacDriver;
