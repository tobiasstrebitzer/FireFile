
FBL.ns(function() { with(FBL) {

	const PromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

	Firebug.FireFile.CssTests = extend(Firebug.Module, {
		
		start: function() {
			var check = {value: false};
            var input = {value: "parse"};
            var result = PromptService.prompt(null, Firebug.FireFile.__("RunTest"), Firebug.FireFile.__("EnterTestToRun"), input, null, check);

			if(result) {
				var method = input.value + "Test";
				this[method].call();
			}

		},
		
		
		runTest: function(obj, sheet) {
			var result = null;
			var t0 = new Date().getTime();
			eval(obj.test);
			var t1 = new Date().getTime();
			var duration = t1 - t0;
			Firebug.Console.log( obj.name + ": " + duration + " ms");
			return result;
		},
		
		ftpTest: function() {
			Firebug.FireFile.FtpTools.connect("strebitzer.at", "login-14.hoststar.at", "21", "web227", "d0mingoo", "/html/cherrybomb/css/", "style2.css");
		},
		
		parseTest: function() {
			
			// Get all sheets
			var sheets = FirebugContext.global.document.styleSheets;

			// Define Tests
			var tests = [{
				name: "comress",
				test: "result = Firebug.FireFile.CssTransformer.generateCSSContents(sheet,true);"
			},{
				name: "tidy",
				test: "result = Firebug.FireFile.CssTransformer.generateCSSContents(sheet,false);"
			}];

			for(var s=0;s<sheets.length;s++) {
				for(var i=0;i<tests.length;i++) {
					var result = Firebug.FireFile.CssTests.runTest(tests[i], sheets[s]);
					Firebug.Console.log({result: result});
				}
			}

			top.FirebugChrome.selectPanel("console");

		}
		
	});
	
	Firebug.registerModule(Firebug.FireFile.CssTests);

}});
