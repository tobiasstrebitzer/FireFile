
FBL.ns(function() { with(FBL) {

	const PromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

	Firebug.FireFile.DataUtils = extend(Firebug.Module, {

		saveTemporaryFile: function(fileName, fileContents) {

			// Create temporary file
			var file = Cc["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
			file.append(fileName);
			file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);

			// Write contents to file
			var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
			foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); 
			var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
			converter.init(foStream, "UTF-8", 0, 0);
			converter.writeString(fileContents);
			converter.close();
			
			// Return file
			return(file);
		},
		
		fetchInput: function(title, label, value) {

            var check = {value: false};
            var input = {value: value};
            var result = PromptService.prompt(null, title, label, input, null, check);

			if(result && input.value != "") { 
				return input.value;
			}else{
				return false;
			}
		},
		
		saveFileFtp: function(site, filePath, fileName, fileHandle, onError, onSuccess) {
			var self = this;
			
			try{
				
				var self = this;
				var ftp = (new Firebug.FireFile.FtpClient(site.ftp_host.replace("ftp://", ""), site.ftp_port))
				  .user(site.ftp_user)
				  .pass(site.ftp_pass)
				  .getResult(function(data) {
						var lastresponse = this.responses[this.responses.length - 1];
						if(lastresponse.substr(0,3) == "530") {
							// Login incorrect
							onError.call(self, {
								msg: "InvalidLogin"
							});
							this.quit
						}
						Firebug.Console.log(this);
				  });
				
				// Check if login was succesful
				
				ftp.pwd()
				  .cwd(filePath)
				  .type('A')
				  .port(null, 50246)
				  .list(function(files) {
				
						// Check if file exists
						var fileExists = false;
						for(var i=0;i<files.length;i++) {
							if(files[i].file == fileName) {
								fileExists = true;
							}
						}
					
						// Cancel if file does not exist
						if(!fileExists) {
							onError.call(self, {
								msg: "FileDoesNotExist"
							});
							this.quit();
						}else{
							this.type('I')
							  .port(null, 50247)
							  .storfile(fileHandle, fileName, function(success) {
									if(!success) {
										onError.call(self, {
											msg: "UploadError"
										});
									}else{
										onSuccess.call(self, {
											msg: "FireSuccessfullySaved"
										});
									}
								}).quit();
						}
				  });
				
			}catch(ex){
				Firebug.Console.log(ex);
			
			
			}
			
		}
	});

	Firebug.registerModule(Firebug.FireFile.DataUtils);

}});
