import { default as library } from '../src/index.js';
import { expect } from 'chai';
import sinon from 'sinon';
import mqtt from 'mqtt';
import events from 'events';

console.info = () => {};

describe('application', () => {

  describe('constructor', () => {

    it('should throw an error if instantiated without config', () => {
      expect(() => {
        let client = new library.application();
      }).to.throw(/missing properties/);
    });

    it('should throw an error if url is not present', () => {
      expect(() => {
        let client = new library.device({});
      }).to.throw(/url must exist and be a string/);
    });

    it('should throw an error if org is not present', () => {
      expect(() => {
        let client = new library.application({url: 'mqtt://localhost:1883'});
      }).to.throw(/org must exist and be a string/);
    });

    it('should throw an error if org is not a string', () => {
      expect(() => {
        let client = new library.application({org: false, url: 'mqtt://localhost:1883'});
      }).to.throw(/org must exist and be a string/);
    });

    it('should throw an error if id is not present', () => {
      expect(() => {
        let client = new library.application({org:'cseid', url: 'mqtt://localhost:1883'});
      }).to.throw(/id must exist and be a string/);
    });

    it('should throw an error if auth-method is not "token"', () => {
      expect(() => {
        let client = new library.application({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-method': 'abc'});
      }).to.throw(/unsupported authentication method/);
    });

    it('should throw an error if auth-token is not present', () => {
      let client;
      expect(() => {
        client = new library.application({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-method': 'token'});
      }).to.throw(/config must contain auth-token/);
    });

    it('should throw an error if auth-key is not present', () => {
      let client;
      expect(() => {
        client = new library.application({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': 'abc'});
      }).to.throw(/config must contain auth-key/);
    });

    it('should be an instance of library.application', () => {
      let client = new library.application({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'key'});
      expect(client).to.be.instanceof(library.application);
    });
  });

  describe('.connect()', () => {
    afterEach(() => {
      if (mqtt.connect && mqtt.connect.restore) { 
        mqtt.connect.restore();
      }
      if (mqtt.publish && mqtt.publish.restore) {
        mqtt.publish.restore();
      }
    });

    it('should connect to the correct broker', () => {
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: function(){}
      });

      let client = new library.application({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': 'abc', 'auth-key': 'key'});
      client.connect();
    });

    it('should set up a callback for the "offline" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.application({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': 'abc', 'auth-key': 'key'});
      client.connect();

      expect(on.calledWith('offline')).to.be.true;
    });

    it('should set up a callback for the "close" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.application({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': 'abc', 'auth-key': 'key'});
      client.connect();

      expect(on.calledWith('close')).to.be.true;
    });

    it('should set up a callback for the "error" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();

      expect(on.calledWith('error')).to.be.true;
    });

    it('should set up a callback for the "connect" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();

      expect(on.calledWith('connect')).to.be.true;
    });

    it('should set up a callback for the "message" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();

      expect(on.calledWith('message')).to.be.true;
    });

    it.skip('should setup a "deviceEvent" event for messages arriving on the device-event topic', () => {
      let callback = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let cseid = 'mn-cse';
      let appid = 'ae-20c78065-6a65-4bd2-9c79-e2c350f454e4';

      let client = new library.application({org:cseid, id:appid, url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();

      client.on('deviceEvent', callback);
      client.log.setLevel('debug');

      let topic = '/oneM2M/req/' + cseid + '/' + appid + '/json';
      let payload = [{
        op: 5,
        rqi: 'rqi/test0',
        fr: cseid,
        to: appid,
        pc: {
          sgn: {
            sur: '/' + cseid + '/sub-abf5c800-cd31-42a8-82c6-bfc3d05ee897',
            nev: {
              cin: {
                pi: "cnt-97e5843f-f774-456d-b790-f24f483fb72e",
                ty: 4,
                ri: "cin-73f645c2-15c0-4121-a5db-3f310f95a0f5",
                rn: "cin-73f645c2-15c0-4121-a5db-3f310f95a0f5",
                ct: "20170116T222008",
                lt: "20170116T222008",
                lbl: "RR",
                st: 0,
                cr: "/mn-cse/ae-20c78065-6a65-4bd2-9c79-e2c350f454e4",
                cnf: "text/plain:0",
                con: 'event test'
              },
              rss: 2001
            }
          }
        }
      },
      {
        "rqi": "rqi/test1",
        "fr": "mn-cse",
        "to": "/mn-cse/ae-20c78065-6a65-4bd2-9c79-e2c350f454e4",
        "rsc": 2000,
        "pc": {
          "sub": {
          "pi": "cnt-97e5843f-f774-456d-b790-f24f483fb72e",
          "ty": 23,
          "ri": "sub-e3e70168-7a55-48ad-a58c-48662a2cce46",
          "rn": "s-ae-20c78065-6a65-4bd2-9c79-e2c350f454e4",
          "ct": "20170117T110223",
          "lt": "20170117T110231",
          "lbl": "RR",
          "st": 0,
          "cr": "/mn-cse/ae-20c78065-6a65-4bd2-9c79-e2c350f454e4",
          "enc": {
            "om": {
            "opr": 1
            },
            "atr": {
            "ty": 4
            }
          },
          "nu": "mqtt://localhost:1883"
          }
        }
      },      
      {
        "rqi": "rqi/test2",
        "fr": "mn-cse",
        "to": "/mn-cse/ae-20c78065-6a65-4bd2-9c79-e2c350f454e4",
        "rsc": 2000,
        "pc": {
          "uril": "/mn-cse/home_gateway/light_ae2/dev/typeE/e1/evt/s-ae-20c78065-6a65-4bd2-9c79-e2c350f454e4"
        }
      }].map(e => JSON.stringify(e, null, ' '));

      client.rqps['rqi/test1'] = () => {};
      client.rqps['rqi/test2'] = () => {};
      fakeMqtt.emit('message', topic, payload[0]);
      fakeMqtt.emit('message', topic.replace('req', 'resp'), payload[1]);
      fakeMqtt.emit('message', topic.replace('req', 'resp'), payload[2]);
      // fakeMqtt.emit('deviceEvent', topic, payload);

      let expectation = [
        '123',
        '123',
        'myevt',
        'json',
        payload,
        topic
      ];

      expect(callback.calledOnce).to.be.true;
      let args = callback.getCall(0).args;
      expect(args).to.deep.equal(expectation);
    });

    it.skip('should setup a "deviceCommand" event for messages arriving on the device-command topic', () => {
      let callback = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();

      client.on('deviceCommand', callback);

      let topic = 'iot-2/type/123/id/123/cmd/mycmd/fmt/json';
      let payload = '{}';

      fakeMqtt.emit('message', topic, payload);

      let expectation = [
        '123',
        '123',
        'mycmd',
        'json',
        payload,
        topic
      ];

      let args = callback.getCall(0).args;

      expect(args).to.deep.equal(expectation);
    });

    it.skip('should setup a "deviceStatus" event for messages arriving on the device-monitoring topic', () => {
      let callback = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();

      client.on('deviceStatus', callback);

      let topic = 'iot-2/type/123/id/123/mon';
      let payload = '{}';

      fakeMqtt.emit('message', topic, payload);

      let expectation = [
        '123',
        '123',
        payload,
        topic
      ];

      let args = callback.getCall(0).args;

      expect(args).to.deep.equal(expectation);
    });

    it.skip('should setup an "appStatus" event for messages arriving on the app-monitoring topic', () => {
      let callback = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();

      client.on('appStatus', callback);

      let topic = 'iot-2/app/123/mon';
      let payload = '{}';

      fakeMqtt.emit('message', topic, payload);

      let expectation = [
        '123',
        payload,
        topic
      ];

      let args = callback.getCall(0).args;

      expect(args).to.deep.equal(expectation);
    });
  });

  describe('.subscribe()', () => {
    afterEach(() => {
      if(mqtt.connect.restore){
        mqtt.connect.restore();
      }
    });

    it('should throw an error when trying to subscribe without being connected', () => {
      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.log.disableAll();
      expect(() => {
        client.subscribe('mytopic');
      }).to.throw(/Client is not connected/);
    });

    it('should throw an error when trying to unsubscribe without being connected', () => {
      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.log.disableAll();
      expect(() => {
        client.unsubscribe('mytopic');
      }).to.throw(/Client is not connected/);
    });

    it.skip('should subscribe to the specified topic', () => {
      let subscribe = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      fakeMqtt.subscribe = subscribe;
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      let topic = 'mytopic';
      client.connect();
      fakeMqtt.emit('connect');
      client.subscribe(topic);

      let args = subscribe.getCall(0).args;
      expect(args[0]).to.equal(topic);
      expect(args[1]).to.deep.equal({qos: 0});
      expect(client.subscriptions[0]).to.equal(topic);
    });
  });

  describe('.publish()', () => {
    afterEach(() => {
      if(mqtt.connect.restore){
        mqtt.connect.restore();
      }
    });

    it('should throw an error when trying to subscribe without being connected', () => {
      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.log.disableAll();
      expect(() => {
        client.publish('mytopic', 'mymessage');
      }).to.throw(/Client is not connected/);
    });

    it('should publish to the device event', () => {
      let publish = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      fakeMqtt.publish = publish;
      fakeMqtt.subscribe = () => { client.isConnected = true; };
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.log.disableAll();
      let typeId = 'type0';
      let deviceId = 'device0';
      let message = 'event body';
      client.connect();
      fakeMqtt.emit('connect');

      client.publishDeviceEvent(typeId, deviceId, 'event0', message);

      let args = publish.getCall(0).args;
      expect(args[0]).to.equal('/oneM2M/req/123/regorg/json');
      expect(args[1]).to.equal('{"rqi":"123/0","to":"/regorg/123/dev/type0/device0/evt","fr":"/regorg/123","op":1,"pc":{"cin":{"con":"event body","cnf":"text/plain:0","lbl":"event0"}},"ty":4}');
    });

    it('should publish to the device command', () => {
      let publish = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      fakeMqtt.publish = publish;
      fakeMqtt.subscribe = () => { client.isConnected = true; };
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.log.disableAll();
      let typeId = 'type0';
      let deviceId = 'device0';
      let message = 'command body';
      client.connect();
      fakeMqtt.emit('connect');
      
      client.publishDeviceCommand(typeId, deviceId, 'command0', message);

      let args = publish.getCall(0).args;
      expect(args[0]).to.equal('/oneM2M/req/123/regorg/json');
      expect(args[1]).to.equal('{"rqi":"123/0","to":"/regorg/123/dev/type0/device0/cmd","fr":"/regorg/123","op":1,"pc":{"cin":{"con":"command body","cnf":"text/plain:0","lbl":"command0"}},"ty":4}');
    });

    it('should publish to the specified topic', () => {
      let publish = sinon.spy();
      let fakeMqtt = new events.EventEmitter();
      fakeMqtt.publish = publish;
      fakeMqtt.subscribe = () => { client.isConnected = true; };
      let mqttConnect = sinon.stub(mqtt, 'connect').returns(fakeMqtt);

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      let path = 'path';
      let message = 'mymessage';
      client.connect();
      fakeMqtt.emit('connect');
      client.publish(path, message);

      let args = publish.getCall(0).args;
      expect(args[0]).to.equal('/oneM2M/req/123/regorg/json');
      expect(args[1]).to.equal('{"rqi":"123/0","to":"/regorg/123/path","fr":"/regorg/123","op":1,"pc":{"cin":{"con":"mymessage","cnf":"text/plain:0"}},"ty":4}');
    });
  });

  describe('.subscribe to Events, commands, status', () => {

    it.skip('should successfully subscribe to device event', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToDeviceEvents('type', 'id', 'test');

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/type/type/id/id/evt/test/fmt/json')
      expect(subSpy.calledWith('iot-2/type/type/id/id/evt/test/fmt/json',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully subscribe to device event with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToDeviceEvents();

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/type/+/id/+/evt/+/fmt/+')
      expect(subSpy.calledWith('iot-2/type/+/id/+/evt/+/fmt/+',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully subscribe to device commands', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToDeviceCommands('type','id','test','json');

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/type/type/id/id/cmd/test/fmt/json')
      expect(subSpy.calledWith('iot-2/type/type/id/id/cmd/test/fmt/json',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully subscribe to device commands with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToDeviceCommands();

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/type/+/id/+/cmd/+/fmt/+')
      expect(subSpy.calledWith('iot-2/type/+/id/+/cmd/+/fmt/+',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully unsubscribe to device event', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      let QOS = 0;

      client.unsubscribeToDeviceEvents('type','id','test','json');

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/type/type/id/id/evt/test/fmt/json')).to.be.true;
    });

    it.skip('should successfully unsubscribe to device event with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      client.unsubscribeToDeviceEvents();

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/type/+/id/+/evt/+/fmt/+')).to.be.true;
    });

    it.skip('should successfully unsubscribe to device commands', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      client.unsubscribeToDeviceCommands('type','id','test','json');

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/type/type/id/id/cmd/test/fmt/json')).to.be.true;
    });

    it.skip('should successfully unsubscribe to device commands with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      client.unsubscribeToDeviceCommands();

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/type/+/id/+/cmd/+/fmt/+')).to.be.true;
    });

    it.skip('should successfully subscribe to device status', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToDeviceStatus('type','id');

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/type/type/id/id/mon')
      expect(subSpy.calledWith('iot-2/type/type/id/id/mon',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully subscribe to device status with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToDeviceStatus();

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/type/+/id/+/mon')
      expect(subSpy.calledWith('iot-2/type/+/id/+/mon',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully subscribe to application status', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToAppStatus('appId');

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/app/appId/mon')
      expect(subSpy.calledWith('iot-2/app/appId/mon',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully subscribe to application status with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'subscribe');

      let QOS = 0;

      client.subscribeToAppStatus();

      subSpy.restore();
      expect(client.subscriptions[0]).to.equal('iot-2/app/+/mon')
      expect(subSpy.calledWith('iot-2/app/+/mon',{qos: QOS})).to.be.true;
    });

    it.skip('should successfully unsubscribe to device status', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      let QOS = 0;

      client.unsubscribeToDeviceStatus('type','id');

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/type/type/id/id/mon')).to.be.true;
    });

    it.skip('should successfully unsubscribe to device status with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      let QOS = 0;

      client.unsubscribeToDeviceStatus();

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/type/+/id/+/mon')).to.be.true;
    });

    it.skip('should successfully unsubscribe to application status', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      let QOS = 0;

      client.unsubscribeToAppStatus('appId');

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/app/appId/mon')).to.be.true;
    });

    it.skip('should successfully unsubscribe to application status with wild card', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let subSpy = sinon.spy(client.mqtt,'unsubscribe');

      let QOS = 0;

      client.unsubscribeToAppStatus();

      subSpy.restore();
      expect(subSpy.calledWith('iot-2/app/+/mon')).to.be.true;
    });

    //publish
    it('should successfully publish device event', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let pubSpy = sinon.spy(client.mqtt,'publish');

      let QOS = 0;

      client.publishDeviceEvent('type','id','stat','message');

      pubSpy.restore();
      expect(pubSpy.calledOnce).to.be.true;
      expect(pubSpy.calledWith(
        '/oneM2M/req/123/regorg/json',
        '{"rqi":"123/0","to":"/regorg/123/dev/type/id/evt","fr":"/regorg/123","op":1,"pc":{"cin":{"con":"message","cnf":"text/plain:0","lbl":"stat"}},"ty":4}',
        { qos: 0 })
      ).to.be.true;
    });

    it('should throw an error when no params passed to publishDeviceEvent', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.log.disableAll();
      expect(() => {
        client.publishDeviceEvent();
      }).to.throw(/publishDeviceEvent/);

    });

    it('should successfully publish device command', () => {

      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let pubSpy = sinon.spy(client.mqtt,'publish');

      let QOS = 0;

      client.publishDeviceCommand('type','id','blink','message');

      pubSpy.restore();
      expect(pubSpy.calledOnce).to.be.true;
      expect(pubSpy.calledWith(
        '/oneM2M/req/123/regorg/json',
        '{"rqi":"123/0","to":"/regorg/123/dev/type/id/cmd","fr":"/regorg/123","op":1,"pc":{"cin":{"con":"message","cnf":"text/plain:0","lbl":"blink"}},"ty":4}',
        { qos: 0 })
      ).to.be.true;
    });

    it('should throw an error when no params passed to publishDeviceCommand', () => {
      let client = new library.application({org:'regorg', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'auth-key': 'abc'});
      client.log.disableAll();
      expect(() => {
        client.publishDeviceCommand();
      }).to.throw(/publishDeviceCommand/);
    });

  });

});
