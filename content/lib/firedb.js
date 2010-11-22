FBL.ns(function() { with(FBL) { 

	Firebug.FireFile.FireDb = function(dbname) {
		// Setup private variables
		this._models = [];
		this._dbhandle = this.getHandle(dbname);
		
		// dynamic variables
		this._select = [];
		this._from = [];
		this._where = [];
		this._orderby = [];
		

	};
	
	Firebug.FireFile.FireDb.prototype = {
		
		getHandle: function(dbname) {
			
			// return handle if exists
			if(this._dbhandle != undefined) {
				return this._dbhandle;
			}
			
			// Load SQLite file
			var dbFile = Components.classes["@mozilla.org/file/directory_service;1"]  
				.getService(Ci.nsIProperties)  
				.get("ProfD", Ci.nsIFile);  
			dbFile.append(dbname + ".sqlite");

			// Check if file exists
			var fileExisted = dbFile.exists();
			var dbhandle = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService).openDatabase(dbFile);
			if (!fileExisted) {
				dbhandle.executeSimpleSQL("CREATE TABLE models (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
			}

			return dbhandle;
		},
		
		// Select
		select: function(obj) {
			
			if(obj instanceof Array) {
				this._select = obj;
			}else if(obj.constructor == String) {
				this._select = obj.split(",");
			}else{
				throw({error: "Invalid select", obj: obj});
			}
			
			return this;
		},
		
		from: function(obj) {
			if(obj instanceof Array) {
				this._from = obj;
			}else if(obj.constructor == String) {
				this._from = obj.split(",");
			}else if(obj instanceof Object) {
				this._from = [];
				for(var key in obj) {
					this._from.push(key + " as " + obj[key]);
				}
			}else{
				throw({error: "Invalid from", obj: obj});
			}
			
			return this;
		},
		
		where: function(obj, value) {
			
			if(obj instanceof Array) {
				this._where = obj;
			}else if(obj.constructor == String) {
				if(value != undefined) {
					if(value typeof Number) {
						this._where.push(obj + " = " + value);
					}else{
						this._where.push(obj + " = '" + value + "'");
					}
				}else{
					this._where = obj.split(" AND ");
				}
				

			}else if(obj instanceof Object) {
				this._where = [];
				for(var key in obj) {
					this._where.push(key + " as " + obj[key]);
				}
			}else{
				throw({error: "Invalid from", obj: obj});
			}
			
			return this;
		},
		
		// Get Query
		getQuery: function() {
			
			// select, from
			var query = "select " + this._select.join(", ") + " from " + this._from.join(", ");
			
			// where
			if(!this.where.empty()) {
				query += " where " + this._where.join(" AND ");
			}
			
			return  + where
		},
		
		// Fetch
		getResults: function() {
			
			var dbConnection = us.engy.rehostImage.database.getDBConnection();

			var getHistoryStatement = dbConnection.createStatement("SELECT destinationUrl FROM uploadHistory ORDER BY id DESC");

			if (getHistoryStatement.executeAsync != null) {
				// Use async query if we are in FF 3.5+
				getHistoryStatement.executeAsync({
					handleResult: function(aResultSet){
						var newHistoryString = "";
						for (var row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
							newHistoryString += row.getResultByName("destinationUrl") + "\n";
						}

						document.getElementById("historyText").value = newHistoryString;
					},

					handleError: function(aError){
					},

					handleCompletion: function(aReason){
					}
				});
			}
			else {
				// Use synchronous query for FF 3.0
				try {
					var newHistoryString = "";
					while (getHistoryStatement.executeStep()) {
						newHistoryString += getHistoryStatement.getString(0) + "\n";
					}

					document.getElementById("historyText").value = newHistoryString;
				}
				finally {
					getHistoryStatement.reset();
				}
			}
		}
		
	};

}});