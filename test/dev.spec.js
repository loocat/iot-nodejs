import { default as library } from '../src/index.js';
import { expect } from 'chai';
import sinon from 'sinon';
import mqtt from 'mqtt';

console.info = () => {};

describe('device', () => {

  describe('constructor', () => {

    it('should throw an error if instantiated without config', () => {
      expect(() => {
        let client = new library.device();
      }).to.throw(/missing properties/);
    });

    it('should throw an error if url is not present', () => {
      expect(() => {
        let client = new library.device({});
      }).to.throw(/url must exist and be a string/);
    });

    it('should throw an error if org is not present', () => {
      expect(() => {
        let client = new library.device({url: 'mqtt://localhost:1883'});
      }).to.throw(/org must exist and be a string/);
    });

    it('should throw an error if org is not a string', () => {
      expect(() => {
        let client = new library.device({org: false, url: 'mqtt://localhost:1883'});
      }).to.throw(/org must exist and be a string/);
    });

    it('should throw an error if id is not present', () => {
      expect(() => {
        let client = new library.device({org:'cseid', url: 'mqtt://localhost:1883'});
      }).to.throw(/id must exist and be a string/);
    });

    it('should throw an error if type is not present', () => {
      expect(() => {
        let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123'});
      }).to.throw(/config must contain type/);
    });

    it('should throw an error if auth-token is not present', () => {
      let client;
      expect(() => {
        client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'type': '123', 'device': 'token'});
      }).to.throw(/config must contain auth-token/);
    });

    it('should be an instance of library.device', () => {
      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'type': '123', 'device': 'token', 'auth-token': '123'});
      expect(client).to.be.instanceof(library.device);
    });
  });

  describe('.connect()', () => {
    afterEach(() => {
      if(mqtt.connect.restore){
        mqtt.connect.restore();
      }
    });

    it('should connect to the correct broker', () => {
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: function(){}
      });

      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'type': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');
      client.log.setLevel('silent');
    });

    it('should set up a callback for the "offline" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'type': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');
      client.log.setLevel('silent');

      expect(on.calledWith('offline')).to.be.true;
    });

    it('should set up a callback for the "close" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'type': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');

      expect(on.calledWith('close')).to.be.true;
    });

    it('should set up a callback for the "error" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'type': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');

      expect(on.calledWith('error')).to.be.true;
    });

    it('should set up a callback for the "connect" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'type': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');

      expect(on.calledWith('connect')).to.be.true;
    });

    it('should set up a callback for the "message" event', () => {
      let on = sinon.spy();
      let mqttConnect = sinon.stub(mqtt, 'connect').returns({
        on: on
      });

      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'type': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');

      expect(on.calledWith('message')).to.be.true;
    });

  });

  describe('.publish()', () => {

    it('should throw exception when client is not connected', () => {
      let client = new library.device({org:'cseid', id:'123', url: 'mqtt://localhost:1883', 'auth-token': '123', 'type': '123', 'device': 'token'});
      client.log.setLevel('silent');
      expect(() => {
        client.publish('stat','json','test');
      }).to.throw(/Client is not connected/);
    });

    it('should publish event', () => {
      let client = new library.device({org:'cseid', id:'appid', url: 'mqtt://localhost:1883', 'type': 'typeid', device: 'deviceid', 'auth-token': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let pubSpy = sinon.spy(client.mqtt,'publish');

      let QOS = 2;
      client.publish('stat', 'test', QOS);

      expect(pubSpy.calledOnce).to.be.true;
      expect(pubSpy.getCall(0).args[0]).to.be.equal('/oneM2M/req/appid/cseid/json');
      expect(/test/.test(pubSpy.getCall(0).args[1])).to.be.true;
      expect(pubSpy.getCall(0).args[2].qos).to.be.equal(QOS);
    });

    it('should publish event with default QOS 0 if qos is not provided', () => {

      let client = new library.device({org:'cseid', id:'appid', url: 'mqtt://localhost:1883', 'type': 'typeid', device: 'deviceid', 'auth-token': '123', 'device': 'token'});
      client.connect();
      client.log.setLevel('silent');
      //simulate connect
      client.isConnected = true;

      let pubSpy = sinon.spy(client.mqtt,'publish');

      client.publish('stat','test');

      let expectedQOS = 0;
      expect(pubSpy.calledOnce).to.be.true;
      expect(pubSpy.getCall(0).args[0]).to.be.equal('/oneM2M/req/appid/cseid/json');
      expect(/test/.test(pubSpy.getCall(0).args[1])).to.be.true;
      expect(pubSpy.getCall(0).args[2].qos).to.be.equal(expectedQOS);
    });
  });
});
