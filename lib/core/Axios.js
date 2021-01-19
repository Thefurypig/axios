'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  // REVIEW[epic=interceptors,seq=3] 注册拦截器
  // InterceptorManager类中有三个方法 use reject forEach，
  // InterceptorManager内部维护了一个数组来存储子任务任务
  // 这三个方法分别是向队列中添加，删除，以及让每个拦截器中都执行fn(fn即为forEach函数的参数)
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
// REVIEW[epic=interceptors,seq=1] request具体实现
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);

  // Set config.method
  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = 'get';
  }

  // Hook up interceptors middleware
  // REVIEW[epic=interceptors,seq=2] dispatchRequest 为我们使用axios时，项目中调用的请求
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  // REVIEW[epic=interceptors,seq=4] 向拦截器任务列表的头部注册 request任务
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  // REVIEW[epic=interceptors,seq=5] 向拦截器任务列表的尾部注册 response任务
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });
  // 通过上面的注册方式，我们可以知道最后的chain数组会长成的样子是：
  // [ ...requestInterceptor, dispatchRequest,undefined, ...responseInterceptor ]
  // 这样就保证了拦截器执行的顺序
  while (chain.length) {
    // 因为是成对注册的任务fulfilled, rejected所以执行的时候也是shift2次
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: (config || {}).data
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;
