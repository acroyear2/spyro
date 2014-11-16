
module.exports = agent;

var Promise = require('then/promise@5.0.0');
var Emitter = require('component/emitter@1.1.3');
var superagent = require('visionmedia/superagent@0.18.2');
var extend = require('segmentio/extend@1.0.0');

function Definition (name, options, agent) {
  if (!name || !options) throw new Error('missing arguments');
  this.name = name;
  this.options = options;
  this.request = null;
  this.pending = false;
  this.agent = agent;
}

Emitter(Definition.prototype);

Definition.prototype.abort = function () {
  if (this.pending) {
    this.request.abort();
    this.pending = false;
    this.emit('abort', this.request);
    this.off();
  }
};

Definition.prototype.send = function (options) {
  options || (options = {});
  options = extend({}, this.options, options);
  
  if (options.abort) this.agent.abort();

  var request = this.request = superagent(options.method || 'get', options.url);
  
  if (options.headers) {
    for (var i = options.headers.length - 1; i >= 0; i--) {
      request.set(options.headers[i][0], options.headers[i][1]);
    }
  }

  if (options.redirects) request.redirects(options.redirects);
  if (options.timeout) request.timeout(options.timeout);
  if (options.query) request.query(options.query);

  if (options.data && (options.method === 'post' || options.method === 'put' || options.method === 'patch')) {
    request.type('application/json');
    if (options.extra_data)
      options.data = extend({}, options.data, options.extra_data);
  }

  var self = this;
  return (new Promise(function (resolve, reject) {
    if (options.data) request.send(options.data);
    request.end(function (res) {
      if (res.ok) {
        options.res = res;
        if (options.success) options.success(res);
        resolve(res);
      } else if (!res.ok) {
        if (options.error) options.error(res);
        reject(res.error, res);
      }
      if (options.complete) options.complete(res);
      self.pending = false;
      self.off();
    });
    self.pending = true;
  }));
};

function agent (name) {
  var definition = agent.definitions[name];
  if (!module) throw new Error('failed to get ' + name);
  return definition;
}

agent.definitions = {};

agent.define = function (name, options) {
  agent.definitions[name] = new Definition(name, options, agent);
};

agent.abort = function () {
  for (var key in agent.definitions) {
    agent.definitions[key].abort();
  }
};

agent.request = function (name, options) {
  return agent(name).send(options);
}