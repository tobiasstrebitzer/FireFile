FBL.ns(function() { with(FBL) {

	var Cc = Components.classes;
	var Ci = Components.interfaces;
	var WindowMediator      = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
	var ConsoleService      = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
	var DirectoryService    = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties);
	var IOService           = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
	var SocketService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
	var PrefService   = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
	var ProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
	var DNSService = Cc["@mozilla.org/network/dns-service;1"].getService(Ci.nsIDNSService);

	Firebug.FireFile.FtpClient = function(host, port) {
	  this.commandlist = [];
	  this.responses = [];
	  this.flag = true;
	  var socket = this.socket = SocketService.createTransport(null, 0, host, port, this.getProxyInfo());
	  this.ostream = socket.openOutputStream(0, 1024*1024, 1);
	  this.istream = socket.openInputStream(0, 1024*1024, 1);
	  this.bstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	  this.bstream.setInputStream(this.istream);
	  this.pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
	  this.pump.init(this.istream, -1, -1, 0, 0, false);
	  this.pump.asyncRead(this.listener(), null);
	}

	Firebug.FireFile.FtpClient.prototype = {
		
	  lastresult: null,
		
	  getProxyInfo: function() {
	    if (PrefService.getIntPref("network.proxy.type") == 1) {
	      var proxyHost = PrefService.getCharPref("network.proxy.socks");
	      var proxyPort = PrefService.getIntPref("network.proxy.socks_port");
	      if (proxyHost && proxyPort) {
	        return ProxyService.newProxyInfo("socks", proxyHost, proxyPort, 0, 30, null);
	      }
	    }
	  },
	  getHostName: function() {
	    return DNSService.myHostName;
	  },
	  getHostIP: function(){
	    return DNSService.resolve(this.getHostName(), 1).getNextAddrAsString();
	  },
	  listener: function(){
	    var self = this;
	    return {
	      onStartRequest: function(request, context){
	//        log('req start');
	      },
	      onStopRequest: function(request, context, status){
	        self.bstream.close();
	        self.istream.close();
	        self.ostream.close();
	      },
	      onDataAvailable: function(request, context, input, offset, count){
	        var data = self.bstream.readBytes(count);
	        log(data);
	        self.responses.push(data);
	        if(self.flag) self.next();
	      }
	    }
	  },
	  write: function(command, server_flag){
	    if(!server_flag) log(command);
	    var self = this;
	    var ostream = (server_flag)? this.server_ostream : this.ostream;
	    function _write() {
	      try {
	        //get count
	        var count = ostream.write(command, command.length);
	        //Async Write
	        if(count < command.length){
	          command = command.substr(count);
	          ostream.QueryInterface(Ci.nsIAsyncOutputStream);
	          ostream.asyncWait(
	            { onOutputStreamReady: write }, 0, 0, null);
	        } else{
	          //finish
	          ostream.write("\r\n", 2);
	          if(server_flag) self.server.close();
	        }
	      }
	      catch(e) {  }
	    }
	    _write();
	  },
	  user: function(user){
	    return this.set('USER '+user);
	  },
	  pass: function(pass){
	    return this.set('PASS '+pass);
	  },
	  syst: function(){
	    return this.set('SYST');
	  },
	  pwd: function(){
	    return this.set('PWD');
	  },
	  quit: function(){
	    return this.set('QUIT');
	  },
	  cwd: function(dir){
	    return this.set('CWD '+dir);
	  },
	  mkd: function(dir){
	    return this.set('MKD '+dir);
	  },
	  list: function(callback){
		var self = this;
	    return this.set(function(){
	      this.server_func_available = function(request, context, input, offset, count){
	        var data = this.server_bstream.readBytes(count);
	        this.lastresult = data;
					log(data);
					if(callback != undefined) {
						callback.call(self, self.fetchListResult(data));
					}
	      }
	      this.next();
	    })
	    .wait_set('LIST');
	  },
	  retr: function(file){
	    return this.set(function(){
	      var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
	      //面倒なのtempフォルダに
	      var tmp = DirectoryService.get("TmpD", Ci.nsIFile);
	      tmp.append(file);
	      stream.init(tmp, 0x04 | 0x08 | 0x20, 664, 0);
	      this.server_func_available = function(request, context, input, offset, count){
	        var data = this.server_bstream.readBytes(count);
	        stream.write(data, data.length);
	      }
	      this.server_func_stop = function(){
	        stream.close();
	      }
	      this.next();
	    })
	    .wait_set('RETR '+file);
	  },
	  stor: function(file){
	    return this.set(function(){
	      var tmp = DirectoryService.get("TmpD", Ci.nsIFile);
	      var self = this;
	      tmp.append(file);
	      var stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
	      stream.init(tmp, -1, -1, false);
	      var bstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	      bstream.setInputStream(stream);
	      var data = bstream.readBytes(bstream.available());
	      this.server_func_accepted = function(request, context, input, offset, count){
	        self.write(data, true);
	      }
	      this.server_func_stop_listening = function(){
	        bstream.close();
	        stream.close();
	        self.next();
	      }
	      this.next();
	    })
	    .wait_set('STOR '+file);
	  },
	  storfile: function(fileHandle, file, callback) {
	    return this.set(function(){
	      var self = this;
	      var stream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
	      stream.init(fileHandle, -1, -1, false);
	      var bstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	      bstream.setInputStream(stream);
	      var data = bstream.readBytes(bstream.available());
	      this.server_func_accepted = function(request, context, input, offset, count){
	        self.write(data, true);
	      }
	      this.server_func_stop_listening = function(){
	        bstream.close();
	        stream.close();
	        self.next();
					if(callback != undefined) {
						callback.call(self, true);
					}
	      }
	      this.next();
	    })
	    .wait_set('STOR '+file);
	  },
	  size: function(file){
	    return this.set('SIZE '+file);
	  },
/*
	  pasv: function(){
	    return this.set('PASV')
	    .set(function(){
	      var text = this.responses[this.responses.length - 1].match(/(\d+,\d+,\d+,\d+,\d+,\d+)/)[1];
	      var ip, port;
	      [ip, port] = this.resolve_res(text);
	      this.next();
	    })
	  },
*/
	  port: function(address, port){
	    if(!address) address = this.getHostIP();
	    //if(!port)
	    address = address.replace(/\./g, ',');
	    var h = Math.floor(port / 256);
	    var d = port % 256;
	    var self = this;
	    return this.set('PORT '+address+','+h+','+d)
	    .set(function(){
	      if(this.server){
	        this.server.close();
	        this.server = null;
	      }
	      this.server = this.create_server(port);
	      var listener = {
	        onSocketAccepted: function(serv, socket){
	          self.server_istream = socket.openInputStream(0, 1024*1024, 1);
	          self.server_ostream = socket.openOutputStream(0, 1024*1024, 1);
	          self.server_bstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	          self.server_bstream.setInputStream(self.server_istream);

	          self.server_pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
	          self.server_pump.init(self.server_istream, -1, -1, 0, 0, false);
	          if(self.server_func_accepted) self.server_func_accepted.apply(self, arguments);
	          self.server_pump.asyncRead({
	            onStartRequest: function(request, context){
	            },
	            onStopRequest: function(request, context, status){
	              if(Components.isSuccessCode(status)){
	                if(self.server_func_stop) self.server_func_stop.apply(self, arguments);
	                self.server_clear();
	                self.flag = true;
	                self.server.close()
	                self.server = null;
	              }
	            },
	            onDataAvailable: function(request, context, input, offset, count){
	              if(self.server_func_available) self.server_func_available.apply(self, arguments);
	              // self.responses.push(data);
	            }
	          }, null);
	        },
	        onStopListening: function(serv, status){
	          if(self.server_func_stop_listening) self.server_func_stop_listening.apply(self, arguments);
	          self.server_bstream.close();
	          self.server_istream.close();
	          self.server_ostream.close();
	        }
	      }
	      this.server.asyncListen(listener);
	      this.next();
	    });
	  },
	  type: function(type){
	    // type: A, I, E
	    this.set('TYPE '+type);
	    return this;
	  },
	  resolve_res: function(res){
	    var ary = res.split(',');
	    var ip = [];
	    for(var i = 0; i < 4; ++i) ip.push(ary[i]);
	    ip = ip.join('.');
	    var port = (ary[i++]*256-0)+(ary[i]-0);
	    return [ip, port];
	  },
	  create_server: function(port, loopbackOnly, backLog){
	    var server = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);
	    server.init(port, loopbackOnly, backLog);
	    return server;
	  },
	  next: function(){
	    var command, flag;
	    if(this.commandlist.length){
	      [command, flag] = this.commandlist.shift();
	      this.flag = flag;
	      if(command){
	        if(typeof command == 'string' || command instanceof String){
	          this.write(command);
	        } else {
	          command.call(this);
	        }
	      }
	    }
	    return this;
	  },
	  server_clear: function(){
	    this.server_func_available = null;
	    this.server_func_accepted = null;
	    this.server_func_stop = null;
	    return this;
	  },
	  set: function(command){
	    this.commandlist.push([command, true]);
	    return this;
	  },
	  wait_set: function(command){
	    this.commandlist.push([command, false]);
	    return this;
	  },
	  fetchListResult: function(str) {
	  	var retVal = [];
			var lines = str.split("\r\n");
			var regexp = /^([drwx-]{10})\s+([0-9]{1})\s+([a-zA-Z0-9-_.]+)\s+([a-zA-Z0-9-_.]+)\s+([0-9]+)\s+([a-zA-Z]{3}\s+[0-9]{1,2}\s+[0-9:]{5})\s+(.+)$/;
			var result;
			for(var i=0;i<lines.length;i++) {
				result = regexp.exec(lines[i]);
				if(result && result[7] != "." && result[7] != "..") {
					retVal.push({
						perm: result[1],
						flag: result[2],
						user: result[3],
						group: result[4],
						perm2: result[5],
						date: result[6],
						file: result[7],
					});	
				}
			}
			return retVal;
	  }
	}

	function log(msg){
		
		firebug('log', arguments) ||
			ConsoleService.logStringMessage(''+msg);
	}

	function firebug(method, args){
		var win = getMostRecentWindow();
		if(win.FirebugConsole && win.FirebugContext) {
			var console = new win.FirebugConsole(win.FirebugContext, win.content);
			console[method].apply(console, args);
		} else if ( win.Firebug && win.Firebug.Console ) {
			win.Firebug.Console.logFormatted.call(win.Firebug.Console, Array.slice(args), win.FirebugContext, method);
		} else {
			return false;
		}
		return true;
	}

	function getMostRecentWindow(){
	  return WindowMediator.getMostRecentWindow('navigator:browser');
	}
	
}});