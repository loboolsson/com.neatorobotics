'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const FormData = require('form-data');
const NeatoRobot = require('./NeatoRobot');

class NeatoApi {

  constructor() {
    this._clientId = Homey.env.NEATO_CLIENT_ID;
    this._clientSecret = Homey.env.NEATO_SECRET;
    this._scope = Homey.env.NEATO_SCOPES;
    this._apiBaseUrl = 'https://beehive.neatocloud.com';
    this._oAuthBaseUrl = 'https://apps.neatorobotics.com/oauth2';
    this._oAuthRedirectUrl = 'https://callback.athom.com/oauth2/callback/';
    this._oAuth2AuthUrl = `${this._oAuthBaseUrl}/authorize?response_type=code&client_id=${this._clientId}&scope=${this._scope}&redirect_uri=${this._oAuthRedirectUrl}`;
    this._oAuth2TokenUrl = `${this._oAuthBaseUrl}/token`;
    this._token = null;
  }

  _isTokenValid() {
    return Date.now() < this._tokenExpirationTime;
  }

  async get(endpoint) {
    let time = new Date();

    let requestHeaders = {
      Accept: 'application/json',
      Authorization: `Bearer ${this._token.access_token}`,
      'X-Agent': 'Homey',
      'X-Date': time.toUTCString(),
      'Content-type': 'application/json'
    };

    return await fetch(`${this._apiBaseUrl}${endpoint}`, {method: 'GET', headers: requestHeaders});
  }

  /*
  ========================================================================================
  Authorization code
  ========================================================================================
  */
  getOAuth2AuthorizationUrl() {
    return this._oAuth2AuthUrl;
  }

  getToken () {
    return this._token;
  }

  setToken(token) {
    this._token = token;
  }

  async exchangeCode(code) {
    let formData = new FormData();
    formData.append('client_id', Homey.env.NEATO_CLIENT_ID);
    formData.append('client_secret', Homey.env.NEATO_SECRET);
    formData.append('redirect_uri', 'https://callback.athom.com/oauth2/callback/');
    formData.append('grant_type', 'authorization_code');
    formData.append('code', code);

    let response = await fetch(this._oAuth2TokenUrl, {method: 'POST', body: formData});

    // Logs the actual error to console, can't this.log() as it's not a Homey derived class
    if (!response.ok) {
      console.error('Getting access token response status:', response.status);
      console.error('Getting access token response text:', response.statusText);
      throw new Error(Homey.__('failed_to_get_token'));
    }
    return await response.json();
  }

  /*
  ========================================================================================
  API code
  ========================================================================================
  */
  async getRobots() {
    let robots = [];
    let response = await this.get('/users/me/robots');

    // Logs the actual error to console, can't this.log() as it's not a Homey derived class
    if (!response.ok) {
      console.error('Getting robots response status:', response.status);
      console.error('Getting robots response text:', response.statusText);
      throw new Error(Homey.__('error_getting_robots'));
    }
    let responseObject = await response.json();

    for(let i = 0; i < responseObject.length; i++) {
      let robot = responseObject[i];
      robots.push(new NeatoRobot(robot));
    }

    return robots;
  }
}

module.exports = NeatoApi;
