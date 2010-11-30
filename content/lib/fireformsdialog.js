// Firebug Handle
var Firebug = window.arguments[1];

function onLoad() {
	
	// Load Arguments
	getArgs();
	
	// Create fields
	for(var key in this.obj) {
		// Try to find element
		var element = document.getElementById("field_" + key);
		if(element) {
			element.setAttribute("value", this.obj[key]);
		}
	}
	
	// Call custom initializer
	if(this.init) {
		this.init.call(document);
	}
	
}

function getArgs() {
	this.obj = window.arguments[0].obj;
	this.model = window.arguments[0].model;
	this.modelname = window.arguments[0].modelname;
	this.validation = window.arguments[0].validation;
	this.init = window.arguments[0].init;
}

function onDialogAccept() {
	
	try{
		
	// Remove Validations
	var validation_nodes = document.getElementsByClassName("validation", document, "span");
	for (var i=0; i < validation_nodes.length; i++) {
		validation_nodes[i].parentNode.removeChild(validation_nodes[i]);
	};
		
	var errors = [];
	
	// Manupulate Object
	for(var key in this.obj) {
		// Try to find element
		var element = document.getElementById("field_" + key);
		if(element) {
			
			// Validate Object
			if(this.validation[key]) {
				var regexp = new RegExp(this.validation[key].regexp);
				if(!regexp.test(element.value)) {
					errors.push(key);
				}
			}
			
			// Update Object Value
			this.obj[key] = element.value;
		}
	}
	
	if(errors.length) {
		for (var i=0; i < errors.length; i++) {
			var element = document.getElementById("field_" + errors[i]);
			if(element) {
				var validator = document.createElement("span");
				validator.setAttribute("class", "validation");
				validator.appendChild(document.createTextNode(this.validation[errors[i]].error));
				element.parentNode.insertBefore(validator, element);
			}
		};
		
		return false;
	}
	
	// Set output
	window.arguments[0].accepted = true;
	window.arguments[0].obj = this.obj;
	Firebug.Console.log(this.obj);
	
	return true;
	
	}catch(e) {
        alert(e);
	}
}

function onDialogCancel(){
	return true;
}


