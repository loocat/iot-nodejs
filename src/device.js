var format = require('format');
var xhr = require('axios');
var btoa = btoa || require('btoa'); // if browser btoa is available use it otherwise use node module
var util = require('util');

var isDefined = require('./util').isDefined;
var isString = require('./util').isString;
var isNode = require('./util').isNode;

class DeviceClient extends require('./base.js') {
  constructor(config) {
    super(config);

    if (!isDefined(config.type)) {
      throw new Error('[DeviceClient:constructor] config must contain type');
    }
    else if (!isString(config.type)) {
      throw new Error('[DeviceClient:constructor] type must be a string');
    }

    if (!isDefined(config.device)) {
      throw new Error('[DeviceClient:constructor] config must contain device');
    }
    else if (!isString(config.device)) {
      throw new Error('[DeviceClient:constructor] device must be a string');
    }

    this.type = config.type;
    this.device = config.device;
    this.mqttConfig.clientId = require('util').format('d:%s:%s:%s:%s', this.org, this.id, config.type, config.device);

    this.log.info('[DeviceClient:constructor] DeviceClient initialized');

    this.on('command', this.handleCommand);
  }

  //
  // handle received commands
  //
  handleCommand(cmd) {
    // TODO
    console.log('--------COMMAND-------', cmd);
  }

  //
  // publish an event
  //
  publish(type, data, qos, callback) {
    if (!this.isConnected) {
      this.log.error("[DeviceClient:publish] Client is not connected");
      this.emit('error', "[DeviceClient:publish] Client is not connected");
    }
    else {
      this.log.debug('[DeviceClient:publish] event ' + type + ' with payload ' + data + ' with qos ' + qos);
      super.publish(util.format('dev/%s/%s/evt', this.type, this.device), data, {qos:qos, lbl: type}, callback);
    }
    return this;
  }

  // connect(qos, callback) {
  //   if (!Number.isInteger(qos)) { qos = 2; }
  //   super.connect(qos, callback);

  //   var mqtt = this.mqtt;

  //   this.mqtt.on('connect', () => {
  //     this.isConnected = true;
  //     this.log.info("[DeviceClient:connect] DeviceClient Connected");
  //     if (this.retryCount === 0) {
  //       this.emit('connect');
  //     } else {
  //       this.emit('reconnect');
  //     }

  //     //reset the counter to 0 incase of reconnection
  //     this.retryCount = 0;

  //     if (!this.isQuickstart) {
  //       mqtt.subscribe(WILDCARD_TOPIC, { qos: parseInt(qos) }, function () { });
  //     }
  //   });

  //   this.mqtt.on('message', (topic, payload) => {
  //     this.log.debug("[DeviceClient:onMessage] Message received on topic : " + topic + " with payload : " + payload);

  //     let match = CMD_RE.exec(topic);

  //     if (match) {
  //       this.emit('command',
  //         match[1],
  //         match[2],
  //         payload,
  //         topic
  //       );
  //     }
  //   });
  // }

  // publishHTTPS(eventType, eventFormat, payload) {
  //   this.log.debug("[DeviceClient:publishHTTPS] Publishing event of Type: " + eventType + " with payload : " + payload);
  //   return new Promise((resolve, reject) => {
  //     let uri = format("https://%s.messaging.%s/api/v0002/device/types/%s/devices/%s/events/%s", this.org, this.domainName, this.typeId, this.deviceId, eventType);

  //     let xhrConfig = {
  //       url: uri,
  //       method: 'POST',
  //       data: payload,
  //       headers: {

  //       }
  //     };

  //     if (eventFormat === 'json') {
  //       xhrConfig.headers['Content-Type'] = 'application/json';
  //     } else if (eventFormat === 'xml') {
  //       xhrConfig.headers['Content-Type'] = 'application/xml';
  //     }

  //     xhrConfig.headers['Authorization'] = 'Basic ' + btoa('use-token-auth' + ':' + this.deviceToken);
  //     this.log.debug("[DeviceClient:publishHTTPS] " + xhrConfig);

  //     xhr(xhrConfig).then(resolve, reject);
  //   });
  // }
}


module.exports = DeviceClient;