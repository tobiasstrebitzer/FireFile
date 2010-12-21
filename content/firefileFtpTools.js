
FBL.ns(function() { with(FBL) {

/*
	Firebug.FireFile.FtpTools = extend(Firebug.Module, {

		activeserver: null,
		servers: [],
		
		// Services
		transportService: Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService),
	    utf8Converter: Cc["@mozilla.org/intl/utf8converterservice;1"].getService(Ci.nsIUTF8ConverterService),
	    unicodeConverter: Cc["@mozilla.org/intl/scriptableunicodeconverter"].getService(Ci.nsIScriptableUnicodeConverter),
		consoleService: Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService),
		

		connect: function(servername, host, port, user, pass, dir, fileName, fileContents) {
			
			// Setup server
			this.servers[servername] = {
				host: host,
				port: port,
				user: user,
				pass: pass,
				dir: dir,
				fileName: fileName,
				fileContents: fileContents,
				transport: null,
			    sIn: null,
			    sOut: null,
				data: null,
				state: "220"
			};
			
			this.activeserver = servername;
			
			// Initialize Connection
			this.initStream();
			
			// Start listing directory
			this.login();
			
			// this.listDirectory(dir);
			
			// alert(servername);
		},
		
		login: function() {
			// alert("todo: login");
		},
		
		initStream: function() {
			
			var self = this;

			// Initialize Connection
			this.servers[this.activeserver].transport = this.transportService.createTransport(null, 0, this.servers[this.activeserver].host, this.servers[this.activeserver].port, null);
	        this.servers[this.activeserver].sOut = this.servers[this.activeserver].transport.openOutputStream(0, 0, 0);
			var controlStream = this.servers[this.activeserver].transport.openInputStream(0, 0, 0);
	        this.servers[this.activeserver].sIn = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
	        this.servers[this.activeserver].sIn.init(controlStream);

			// Create data listener
	        var dataListener = {
	            data: "",

	            onStartRequest: function(request, context) { },

	            onStopRequest: function(request, context, status) {
	                // self.closeConnection(); TODO

					Firebug.Console.log([request, context, status]);
	                if (status != Components.results.NS_OK) {
						// Connection Error
						// TODO
	                }
	            },

	            onDataAvailable: function(request, context, inputStream, offset, count) {
					
					// Fetch data
	                this.data = self.servers[self.activeserver].sIn.read(count);
					
					// Handle Response
	                self.handleResponse(this.data);
	            }
	        };

			// Start Connection
	        var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
	        pump.init(controlStream, -1, -1, 0, 0, false);
	        pump.asyncRead(dataListener, null);

		},
		
		handleResponse: function(data) {
			var lines = data.split("\r\n");
			
			if(lines.length < 2) {
				throw({error: "InvalidServerResponse"});
			}
			
			// Loop through lines
			for(var i=0;i<lines.length - 1;i++) {
				Firebug.Console.log("RECV: " + lines[i]);
				if(lines[i].length > 3) {
					var status = lines[i].substr(0, 3);
					var msg = lines[i].substr(4);
					this.handleCommand(status, msg);
				}
			}
		},
		
		handleCommand: function(status, msg) {
			
			var state = this.servers[this.activeserver].state.substr(0,3);
			var action = this.servers[this.activeserver].state.substr(3);
			
			if(status != this.servers[this.activeserver].state.substr(0,3)) {
				Firebug.Console.log("SKIP: " + msg + "(" + this.servers[this.activeserver].state.substr(0,3) + ")");
				return false;
				// throw({error: "WrongResponseError", data: { msg: msg }});
			}
			
			switch(this.servers[this.activeserver].state) {
	            case "220": // Username Request
					this.servers[this.activeserver].state = "331";
	                this.sendCommand("USER " + this.servers[this.activeserver].user);
	                break;
	            case "331": // Password Request
					this.servers[this.activeserver].state = "230";
	                this.sendCommand("PASS " + this.servers[this.activeserver].pass);
	                break;
	            case "230": // Login Success
					this.servers[this.activeserver].state = "250";
	                this.sendCommand("CWD " + this.servers[this.activeserver].dir);
	                break;
	            case "250": // Directory Success
					this.servers[this.activeserver].state = "227A";
                    this.sendCommand("PASV");
	                break;
	            case "227A": // PASV Success
					this.servers[this.activeserver].state = "226A";
                    this.servers[this.activeserver].data = new Firebug.FireFile.FtpTools.FtpStream(this.servers[this.activeserver].host, this.getPortFromPasvResponse(msg));
                    this.servers[this.activeserver].data.connectRead();
                    this.sendCommand("LIST");
	                break;
	            case "226A": // List Success
					if (this.servers[this.activeserver].data.finished) {
						Firebug.Console.log(this.servers[this.activeserver].data.listData.toLowerCase());
						// Check if file exists
						if (this.servers[this.activeserver].data.listData.toLowerCase().indexOf(this.servers[this.activeserver].fileName.toLowerCase()) < 0) {
							// File does not exist!
							throw({error: "FileDoesNotExistHere", data: { msg: msg }});
						}
						this.servers[this.activeserver].state = "200";
						this.sendCommand("TYPE I");
					} else {
						this.servers[this.activeserver].data.onFinish = this;
					}
	                break;
	            case "200": // Set Upload Type Binary
					this.servers[this.activeserver].state = "227B";
                    this.sendCommand("PASV");
	                break;
	            case "227B": // Set Passive Mode
					this.servers[this.activeserver].state = "226B";
					this.servers[this.activeserver].data = new Firebug.FireFile.FtpTools.FtpStream(this.servers[this.activeserver].host, this.getPortFromPasvResponse(msg), this.servers[this.activeserver].fileContents);
					this.dataStream.connectWrite();
					this.sendCommand("STOR " + this.servers[this.activeserver].fileName);
	                break;
			}
		},
		
		onDataStreamFinish: function() {
			
			// Check if file exists
			if (this.servers[this.activeserver].data.listData.toLowerCase().indexOf(this.servers[this.activeserver].fileName.toLowerCase()) < 0) {
				// File does not exist!
				throw({error: "FileDoesNotExistHere", data: { msg: msg }});
			}
			this.servers[this.activeserver].state = "200";
			this.sendCommand("TYPE I");
		},
		
		getPortFromPasvResponse: function(pasvResponse) {
	        var pasvAddress = pasvResponse.substring(pasvResponse.indexOf("(") + 1, pasvResponse.indexOf(")"));
	        var addressParts = pasvAddress.split(",");
	        return parseInt(addressParts[4]) * 256 + parseInt(addressParts[5]);
	    },
		
	    sendCommand: function(command) {
			Firebug.Console.log("SEND: " + command);
	        var outputCommand = command + "\r\n";
	        this.servers[this.activeserver].sOut.write(outputCommand, outputCommand.length);
	    },
		
		
	});

	Firebug.registerModule(Firebug.FireFile.FtpTools);

	Firebug.FireFile.FtpTools.FtpStream = function(host, port, fileContents) {
	    this.host = host;
	    this.port = port;
	
		// Create Temporary File
		if(fileContents != undefined) {
			var sourceFile = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
			sourceFile.append(this.servers[this.activeserver].fileName);
			sourceFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
			
			// file is nsIFile, data is a string  
			var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);  
			// use 0x02 | 0x10 to open file for appending.
			foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
			// write, create, truncate  
			// In a c file operation, we have no need to set file mode with or operation,  
			// directly using "r" or "w" usually.  
  
			// if you are sure there will never ever be any non-ascii text in data you can   
			// also call foStream.writeData directly  
			var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].  
			                          createInstance(Components.interfaces.nsIConverterOutputStream);  
			converter.init(foStream, "UTF-8", 0, 0);  
			converter.writeString(data);  
			converter.close(); // this closes foStream
			alert(sourceFile.path);
			
		    this.sourceFile = sourceFile;	
		}

	    this.transportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
	    this.eventTarget = Cc["@mozilla.org/thread-manager;1"].getService().currentThread;
	    this.dataListener = new Firebug.FireFile.FtpTools.DataListener();
	    this.progressEvent = new Firebug.FireFile.FtpTools.ProgressEvent();
	}

	Firebug.FireFile.FtpTools.FtpStream.prototype = {
	    dataTransport: null,
	    dataInstream: null,
	    dataOutstream: null,
	    uploadInputStream: null,

	    tempFile: null,

	    listData: "",
	    finished: false,
		onFinish: null,

	    connectWrite: function() {
	        var fileSize2 = this.sourceFile.fileSize;

	        var fileInputStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
			fileInputStream.init(this.sourceFile, -1, 0, 0);

	        this.uploadInputStream = fileInputStream;

	        this.continueConnectWrite(fileSize2);
	    },

	    continueConnectWrite: function(fileSize) {
	        this.dataTransport = this.transportService.createTransport(null, 0, this.host, this.port, null);

	        this.dataOutstream = this.dataTransport.openOutputStream(0, 0, -1);

	        var binaryOutstream = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);
	        binaryOutstream.setOutputStream(this.dataOutstream);

	        this.dataInstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	        this.dataInstream.setInputStream(this.uploadInputStream);

	        this.progressEvent.parent = this;
	        this.progressEvent.dataInstream = this.dataInstream;
	        this.progressEvent.dataOutstream = binaryOutstream;
	        this.progressEvent.bytesTotal = fileSize;

	        this.dataTransport.setEventSink(this.progressEvent, this.eventTarget);

	        var dataBuffer = this.dataInstream.readBytes(this.dataInstream.available() < 4096 ? this.dataInstream.available() : 4096);
	        this.progressEvent.dataOutstream.writeBytes(dataBuffer, dataBuffer.length);
	    },

	    connectRead: function() {
	        this.dataTransport = this.transportService.createTransport(null, 0, this.host, this.port, null);

	        var dataStream = this.dataTransport.openInputStream(0, 0, 0);
	        this.dataInstream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
	        this.dataInstream.setInputStream(dataStream);

	        this.dataListener.parent = this;
	        this.dataListener.dataInstream = this.dataInstream;

	        var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
	        pump.init(dataStream, -1, -1, 0, 0, false);
	        pump.asyncRead(this.dataListener, null);
	    },

	    kill: function() {
	        if (this.dataInstream) {
	            this.dataInstream.close();
	        }

	        if (this.dataOutstream) {
	            this.dataOutstream.flush();
	            this.dataOutstream.close();
	        }

	        if (this.uploadInputStream) {
	            this.uploadInputStream.close();
	        }

	        if (this.dataTransport) {
	            this.dataTransport.close("Finished");
	        }

	        this.dataListener.parent = null;
	        this.progressEvent.parent = null;
	        this.finished = true;

			if (this.onFinish != null) {
				this.onFinish.onDataStreamFinish();
			}

			this.onFinish = null;
	    }
	}

	Firebug.FireFile.FtpTools.DataListener = function () { }

	Firebug.FireFile.FtpTools.DataListener.prototype = {
	    parent: null,
	    dataInstream: null,
	    data: "",

	    onStartRequest: function(request, context) {
	    },

	    onStopRequest: function(request, context, status) {
	        if (this.parent) {
	            this.parent.listData = this.data;
	            this.parent.kill();
	        }
	    },

	    onDataAvailable: function(request, context, inputStream, offset, count) {
	        this.data += this.dataInstream.readBytes(count);
	    }
	}

	Firebug.FireFile.FtpTools.ProgressEvent = function() { }

	Firebug.FireFile.FtpTools.ProgressEvent.prototype = {
	    parent: null,

	    dataInstream: null,
	    dataOutstream: null,

	    bytesTotal: 0,

	    onTransportStatus: function(transport, status, progress, progressMax) {
	        if (progress == this.bytesTotal) {  // finished writing
	            this.parent.kill();
	            return;
	        }

	        // us.engy.rehostImage.main.reportProgress((progress * 100) / this.bytesTotal);

	        var dataBuffer = this.dataInstream.readBytes(this.dataInstream.available() < 4096 ? this.dataInstream.available() : 4096);
	        this.dataOutstream.writeBytes(dataBuffer, dataBuffer.length);
	    }
	}

*/

}});
