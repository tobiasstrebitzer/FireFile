FBL.ns(function() { with(FBL) {

	Firebug.FireFile.FireForms = function(model, config, onSuccess) {

		// Setup defaults
		this.settings = {
			validation: {},
			title: "FireForms",
			description: "Input Text / HTML",
			forms_path: "chrome://FireFile/content/forms/"
		};
		
		this.model = model;
		
		// Merge defaults with config
		for (var key in config) {
			this.settings[key] = config[key];
		};
		
		this.onSuccess = onSuccess;
		
		this.initialize();
		
		return this;
	}

	Firebug.FireFile.FireForms.prototype = {
		
		initialize: function() {
			Firebug.Console.log("initialize");
		},
		
		editDialog: function(obj) {
			
			var params = {
				obj: obj,
				validation: this.settings.validation,
				model: this.model,
				modelname: "Site",
				accepted: false,
				init: function() {
					if(obj.is_ftp === 0) {
						var el = this.getElementById("group_ftp");
						el.parentNode.removeChild(el);
					}
				}
			};

			// Open Dialog
			window.openDialog(
			  	this.settings.forms_path + this.model + "_edit.xul",
			  	this.model + "-edit-dialog", 
				"chrome,centerscreen,modal", params, Firebug);

			// Check if accepted
			if(params.accepted === true) {
				return params.obj;
			}else{
				return false;
			}
		},
		
		openDialog: function() {

		}
		
	};
	
}});