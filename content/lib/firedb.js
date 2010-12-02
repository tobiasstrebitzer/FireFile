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
		
		this._table = null;
		this._lastid = null;

	};
	
	Firebug.FireFile.FireDb.prototype = {
		
		getHandle: function(dbname) {
			
			// return handle if exists
			if(this._dbhandle != undefined) {
				return this._dbhandle;
			}
			
			// Load SQLite file
			var dbFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
			dbFile.append(dbname + ".sqlite");
			
			// Check if file exists
			var fileExisted = dbFile.exists();
			var dbhandle = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService).openDatabase(dbFile);
			if (!fileExisted) {	
				try{
					dbhandle.createTable("models", "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT");
				}catch(error) {
					alert(error);
				}
				
				alert("ok");
				// dbhandle.executeSimpleSQL("CREATE TABLE models (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
			}

			return dbhandle;
		},
		
		exists: function(table) {
			
			if(table == undefined) {
				table = this._table;
			}
			
			return this._dbhandle.tableExists(table);
		},
		
		// Create
		create: function(table, fields, droptable) {
			
			// Check if table exists
			if(this._dbhandle.tableExists(table)) {
				if(droptable) {
					this._dbhandle.executeSimpleSQL("DROP TABLE " + table + ";");
				}else{
					throw({error: "Table exists", table: table});
				}
			}
			
			var colStrings = [];
			for(var key in fields) {
				var colString = key;
				
				// Type
				if(fields[key].type) {
					colString += " " + fields[key].type;
				}else{
					colString += " TEXT";
				}

				// Auto Increment
				if(fields[key].primary_key && fields[key].primary_key === true) {
					colString += " PRIMARY KEY";
				}
				
				// Auto Increment
				if(fields[key].autoincrement && fields[key].autoincrement === true) {
					colString += " AUTOINCREMENT";
				}
				
				colStrings.push(colString);
			}
			
			var query = "CREATE TABLE " + table + " (" + colStrings.join(", ") + ");";
			this._dbhandle.executeSimpleSQL(query);
			
			// Set Current Table
			this._table = table;
			
			return this;
		},
		
		// Select
		select: function() {
			
			// Reset
			this._select = [];
			this._where = [];
			this._limit = "";
			
			for(var i=0;i<arguments.length;i++) {
				if(arguments[i] instanceof Array) {
					this._select = this._select.concat(arguments[i]);
				}else if(arguments[i].constructor == String) {
					this._select = this._select.concat(arguments[i].split(","));
				}else{
					throw({error: "Invalid select", obj: arguments[i]});
				}
			}
			
			return this;
		},
		
		lastid: function() {
			return this._lastid;
		},
		
		insert: function(data, table) {
			
			// Get current table
			if(table == undefined) {
				table = this._table;
			}
			
			// Check if table exists
			var keys = [];
			var values = [];
			for(var key in data) {
				keys.push(key);
				values.push("'" + data[key] + "'");
			}
						
			var query = "INSERT INTO "+ table + " ( " + keys.join(", ") + " ) VALUES ( " + values.join(", ") + " );";
			
			var statement = this._dbhandle.createStatement(query);
			statement.execute();
			this._lastid = this._dbhandle.lastInsertRowID;
			
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
		
		limit: function(from, to) {
			if(to == undefined) {
				this._limit = from
			}else{
				this._limit = from + ", " + to;
			}
			
			return this;
		},
		
		where: function(obj, value) {
			
			if(obj == undefined) {
				this._where = [];
			}else if(obj instanceof Array) {
				this._where = obj;
			}else if(obj.constructor == String) {
				if(value != undefined) {
					if(!isNaN(value)) {
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
					this._where.push(key + " = '" + obj[key] + "'");
				}
			}else if(!isNaN(obj)) {
				this._where = [];
				this._where.push("id="+obj);
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
			if(this._where.length) {
				query += " where " + this._where.join(" AND ");
			}
			
			// limit
			if(this._limit) {
				query += " LIMIT " + this._limit;
			}
			
			return query;
		},
		
		table: function(table) {
			// Set current Table
			this._table = table;
			return this;
		},
		
		// Grab
		grab: function(obj, table) {
			alert("obj:" + obj);
			// Get default table
			if(table == undefined) {
				table = this._table;
			}
			
			// Defaults
			if(obj == undefined) {
				obj = this.lastid();
			}
			
			// Db methods
			alert("obj:" + obj);
			return this.select("*").from(table).where(obj).limit(1).getResults(true);

		},
		
		// Update
		update: function(data, table) {
			
			// Get current table
			if(table == undefined) {
				table = this._table;
			}
			
			// Build key pairs
			var kvpairs = [];
			for(var key in data) {
				if(key != "id") {
					kvpairs.push(key + "='" + data[key] + "'");
				}
			}
			
			// Update record
			var query = "UPDATE "+ table + " SET " + kvpairs.join(", ") + " WHERE id=" + data.id + ";";
			Firebug.Console.log(query);
			var statement = this._dbhandle.createStatement(query);
			statement.execute();
			
			// Set last id
			this._lastid = data.id;
			
			return this;
		},
		
		// Toggle
		toggle: function(id, field, table) {
			
			// Get current table
			if(table == undefined) {
				table = this._table;
			}
			
			// Get current id
			if(id == undefined) {
				id = this.lastid();
			}
			
			// Update record
			var query = "UPDATE "+ table + " SET " + field + " = (1 - " + field + ") WHERE id=" + id + ";";
			var statement = this._dbhandle.createStatement(query);
			statement.execute();
			
			// Set last id
			this._lastid = id;
			
			return this;
		},
		
		fetch: function() {
			return this.getResults(true);
		},
		
		// Fetch
		getResults: function(first) {
			
			var retVal = [];
			var query = this.getQuery();
			var statement = this._dbhandle.createStatement(query);

			try {
				while (statement.executeStep()) {
					var obj = {};
					for(var i=0;i<statement.columnCount;i++) {
						switch(statement.getColumnDecltype(i)) {
							case "INTEGER":
								obj[statement.getColumnName(i)] = statement.getInt32(i);
								break;
							case "TEXT":
								obj[statement.getColumnName(i)] = statement.getString(i);
								break;
							default:
								obj[statement.getColumnName(i)] = statement.getString(i);
								break;
						}
					}
					
					if(first != undefined && first === true) {
						return obj;
					}
					
					retVal.push(obj);
				}
			}catch(error) {
				throw({error: error, query: query, statement: statement});
			}finally {
				statement.reset();
			}
			return retVal;

		}
		
	};

}});