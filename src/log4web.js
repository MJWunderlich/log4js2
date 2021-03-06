/**
 * Log4Web JavaScript Library v0.0.1
 * http://mjwunderlich.com/proj/log4js/
 *
 * Log4Web is a logging library for JavaScript inspired by the excellent Log4J library.
 *
 * As many loggers as necessary can be setup, each categorized by domain. Domains use dot-notation so
 * that hierarchies can be formed. In the application, simply request a logger by domain name, and
 * a direct match OR a direct ancestor of that domain will be utilized.
 *
 * Adapters do the actual logging, and as many Adapters as necessary can be added to each
 * logger. There are adapters to output logs to the console, the DOM, AJAX, and others can be
 * written and plugged in.
 *
 * Released under the MIT license
 */

/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Mario J. Wunderlich
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(function (globals, window, document, $) {

  'use strict';

  // ****** GLOBALS ****** //

  var slice = [].slice;

  // ****** HELPERS ****** //

  function isArray(mixed) {
    return Object.prototype.toString.call(mixed) == '[object Array]';
  }

  function isMethodSupported(object, methodName) {
    return typeof object[methodName] == 'function';
  }

  function format(fmt /*,  ... */) {
    var args = slice.call(arguments, 1);
    return fmt.replace(/{(\d+)}/g, function (match, number) {
      let local = args.slice(0), n = +number;

      while (local.length) {
        let item = local[0], itemIsArray = isArray(item);
        if (itemIsArray && item.length <= n) {
          n -= item.length;
          local.shift();
        }
        else if (!itemIsArray && n) {
          n--;
          local.shift();
        }
        else {
          local = itemIsArray ? item[n] : item;
          break;
        }
      }

      return !isArray(local) ? local : match;
    });
  }

  function namedFormat(fmt, data) {
    return fmt.replace(/{([\w\d]+)}/g, function (match, name) {
      if (typeof data[name] == 'undefined') {
        return match;
      }
      return '' + data[name];
    });
  }

  var Log4WebClass = {
    extend: function (base, methods) {
      return $.extend({}, base.prototype, methods);
    }
  };

  // ****** MEAT & POTATOES ****** //

  /**
   * Class Log4WebRegistry
   * @constructor
   */
  var Log4WebRegistry = function () {
    this._instancesTable = {};
  };
  Log4WebRegistry.prototype = {
    find: function (domain, fullMatchOnly) {
      var items, instance;

      domain = domain || 'null';
      items = domain.split('.');

      while (items.length) {
        domain = items.join('.');
        instance = this._instancesTable[domain];
        if (instance)
          return instance;
        if (fullMatchOnly)
          return false;
        items.pop();
      }

      return false;
    },

    add: function (instance) {
      if (!!this.find(instance.domain, true)) {
        throw new Error(format('Log4Web instance with domain \'{0}\' already registered', instance.domain));
      }
      this._instancesTable[instance.domain] = instance;
    },

    remove: function (domain) {
      if (!this.find(domain, true)) {
        throw new Error(format('Log4Web instance with domain \'{0}\' not registered', domain));
      }
      delete this._instancesTable[domain];
    }
  };

  var Log4WebAdapter = function(layout) {
    this._layout = layout;
  };
  Log4WebAdapter.prototype = Log4WebClass.extend(Object, {
    get layout() {
      return this._layout;
    },

    set layout(layout) {
      this._layout = layout;
    },

    formatMessage: function(date, type, message, additionalData) {
      if (this._layout) {
        return this._layout.format(date, type, message, additionalData);
      }
      return message;
    }
  });

  /**
   * Class Log4WebConsoleAdapter
   * @constructor
   */
  var Log4WebConsoleAdapter = function (layout) {
    Log4WebAdapter.apply(this, arguments);
    this._engine = console;
  };
  Log4WebConsoleAdapter.prototype = Log4WebClass.extend(Log4WebAdapter, {
    get engine() {
      return this._engine;
    },

    _defaultOutput: function (type, message, additionalData) {
      //message = this.formatMessage((new Date()).toDateString(), type, message, additionalData);
    },

    write: function (type, message, additionalData) {
      message = this.formatMessage((new Date()).toDateString(), type, message, additionalData);
      if (isMethodSupported(this._engine, type)) {
        var method = this._engine[type];
        method.call(this._engine, message);
      }
      else {
        this._defaultOutput.apply(this, arguments);
      }
    }
  });

  /**
   * Class Log4WebAjaxAdapter
   *
   * @param url
   * @param method
   * @param credentials
   * @param fieldName
   * @constructor
   */
  var Log4WebAjaxAdapter = function (url, method, credentials, fieldName) {
    // TODO: validate it's a valid URL
    this._url = url;
    this._method = method || 'get';
    this._credentials = credentials || false;
    this._fieldNames = {
      message: fieldName || 'message'
    };
  };
  Log4WebAjaxAdapter.prototype = {
    get url() {
      return this._url;
    },

    get method() {
      return this._method;
    },

    get credential() {
      return this._credentials;
    },

    get fieldNames() {
      return this._fieldNames;
    },

    getFieldName: function (which) {
      return this.fieldNames[which];
    },

    write: function (type, message, additionalData) {
      var data = {};
      data[this.getFieldName('message')] = message;
      if (additionalData) {
        for (var key in additionalData) {
          var fieldName = this.getFieldName(key) || key;
          data[fieldName] = additionalData[key];
        }
      }
      $.ajax({
        url: this.url,
        type: this.method,
        data: data,
        success: function (response) {

        },
        error: function (xhr, status, error) {

        }
      });
    }
  };

  /**
   * Class Log4WebHtmlAdapter
   *
   * @param options a map of options to configure the HTML adapter, options are:
   *                - target: target DOM element to append to
   *                - template: HTML template, can be a DOM selector or an actual HTML fragment
   *                - messageEl: DOM element within the template where to write the message
   *
   * @constructor
   */
  var Log4WebHtmlAdapter = function (options, layout) {
    Log4WebAdapter.call(this, layout);
    options = options || {};
    this._target = options.target || false;
    this._template = options.template || false;
    this._messageEl = options.messageEl || false;
  };
  Log4WebHtmlAdapter.prototype = Log4WebClass.extend(Log4WebAdapter, {
    write: function (type, message) {
      var sel, template;
      sel = $(this._template);
      template = $($.parseHTML(sel.length ? sel.text() : this._template));
      message = this.formatMessage((new Date()).toDateString(), type, message);
      $(this._messageEl, template).html(message);
      template.appendTo($(this._target));
    }
  });

  var Log4WebInstance = function (domain) {
    this._domain = domain;
    this._instance = Log4Web.getLogger(domain);
    this._muted = 0;
  };

  Log4WebInstance.prototype = {
    get domain() {
      return this._domain;
    },

    get muted() {
      return this._muted;
    },

    get instance() {
      return this._instance || Log4Web.getLogger(domain);
    },

    mute: function () {
      this._muted++;
      return this;
    },

    unmute: function () {
      this._muted--;
      return this;
    },

    log: function (fmt) {
      if (this.muted) return;
      this.instance.log.apply(this.instance, arguments);
    },

    info: function (fmt) {
      if (this.muted) return;
      this.instance.info.apply(this.instance, arguments);
    },

    warn: function (fmt) {
      if (this.muted) return;
      this.instance.warn.apply(this.instance, arguments);
    },

    error: function (fmt) {
      if (this.muted) return;
      this.instance.error.apply(this.instance, arguments);
    }
  };


  /**
   * Class Log4WebLayout
   * @constructor
   *
   * What is a layout?
   * How should layouts work?
   *
   * A layout is a data structure that defines HOW a message will be styled.
   * It can take many forms: json, html, xml, plaintext, etc.
   * Furthermore, the layout must be exposed through a generic interface, so that any
   * Adaptor can use any layout.
   */
  var Log4WebLayout = function (format) {
    this._format = format || '[{date}]: {type}: {message}';
  };
  Log4WebLayout.prototype = {
    format: function(date, type, message, additionalData) {
      var data = $.extend({
        date: date,
        type: type,
        message: message
      }, additionalData || {});
      return namedFormat(this._format, data);
    }
  };

  /**
   * Class Log4WebJSONLayout
   *
   * @param jsonFormat
   * @constructor
   */
  var Log4WebJSONLayout = function(jsonFormat) {
    Log4WebLayout.call(this, jsonFormat);
    //this._format = $.extend({}, jsonFormat);
  };
  Log4WebJSONLayout.prototype = Log4WebClass.extend(Log4WebLayout, {
    format: function (message, date, type, additionalData) {
      var data, format, key, value;
      data = $.extend({}, (additionalData || {}), {
        message: message,
        date: date,
        type: type
      });
      format = $.extend({}, this._format);
      for (key in format) {
        value = this._format[key];
        value = namedFormat(value, data);
        format[key] = value;
      }
      return format;
    }
  });

  /**
   * Class Log4Web
   * @constructor
   */
  var Log4Web = function (domain, adapters, attachToSystemErrors) {
    this._domain = domain ? domain.toLowerCase() : 'null';
    this._adapters = [];
    this._attachToSystemErrors = false;
    this._version = {
      get major() {
        return '0'
      },
      get minor() {
        return '0'
      },
      get revision() {
        return '0'
      }
    };

    if (adapters && isArray(adapters)) {
      this.registerAdapters(adapters);
    }
  };

  Log4Web.prototype = {
    get version() {
      return this._version.major + '.' + this._version.minor + '.' + this._version.revision;
    },

    get domain() {
      return this._domain || 'null';
    },

    get adapters() {
      return [].concat(this._adapters);
    },

    get isAttachedToSystemErrors() {
      return this._attachToSystemErrors;
    },

    set attachToSystemErrors(attachToSystemErrors) {
      var self = this;
      var attach = !!attachToSystemErrors;
      if (attach == this._attachToSystemErrors) {
        return;
      }

      if (attach) {
        $(window).error(function (event) {
          var errorMessage = namedFormat('{message} {filename} {lineno}', event.originalEvent);
          self.error(errorMessage);
        });
      }
    },

    registerAdapter: function (adapter) {
      if (typeof adapter != 'object' || typeof adapter.write != 'function') {
        throw new Error('Invalid Log4Web adapter');
      }
      this._adapters.push(adapter);
    },

    registerAdapters: function (adapterArray) {
      for (var i = 0; i < adapterArray.length; i++) {
        var adapter = adapterArray[i];
        this.registerAdapter(adapter);
      }
    },

    _write: function (type, fmt /* ... */) {
      var message = format.apply(null, slice.call(arguments, 1));
      for (var i = 0; i < this._adapters.length; i++) {
        var obj = this._adapters[i];
        obj.write(type, message);
      }
    },

    log: function (fmt) {
      this._write.apply(this, ['log'].concat(slice.call(arguments, 0)));
    },

    info: function (fmt) {
      this._write.apply(this, ['info'].concat(slice.call(arguments, 0)));
    },

    warn: function (fmt) {
      this._write.apply(this, ['warn'].concat(slice.call(arguments, 0)));
    },

    error: function (fmt) {
      this._write.apply(this, ['error'].concat(slice.call(arguments, 0)));
    }
  };

  var Log4WebLoggerRegistry = new Log4WebRegistry();

  /**
   * getInstance
   *
   * Returns the current registered Log4Web instance. If none is registered, a new instance is
   * created.
   *
   * @static
   * @returns {*}
   */
  Log4Web.getLogger = function (domain) {
    domain = domain || 'null';
    var instance = Log4WebLoggerRegistry.find(domain);
    if (!instance && domain == 'null') {
      instance = new Log4Web(domain);
      Log4WebLoggerRegistry.add(instance);
    }
    return instance;
  };


  Log4Web.newLogger = function (domain, adapters, attach) {
    var instance = Log4WebLoggerRegistry.find(domain, true);
    if (!instance) {
      instance = new Log4Web(domain, adapters, attach);
      instance.attachToSystemErrors = attach;
      Log4WebLoggerRegistry.add(instance);
    }

    //adapters && instance.registerAdapters(adapters);
    return instance;
  };

  Log4Web.load = function (json) {
    var key, item;
    for (key in json) {
      item = json[key];
      Log4Web.newLogger(key, item.adapters, item.attachToErrorHandler);
    }
  };

  // ****** EXPORTS ******* //

  globals.Log4Web = Log4Web;
  globals.Log4WebInstance = Log4WebInstance;
  globals.Log4WebLayout = Log4WebLayout;
  globals.Log4WebJSONLayout = Log4WebJSONLayout;
  globals.Log4WebConsoleAdapter = Log4WebConsoleAdapter;
  globals.Log4WebAjaxAdapter = Log4WebAjaxAdapter;
  globals.Log4WebHtmlAdapter = Log4WebHtmlAdapter;

})(window, window, document, jQuery);
