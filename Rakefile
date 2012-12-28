require 'pathname'
require 'fileutils'

version = %x[sed -n -e 's/<em:version>\\(.*\\)<\\/em:version>/\\1/p' install.rdf].strip

task :getversion do
    puts version
end

task :setversion, :version do |t, args|
    system("sed -i '' -E 's/<em:version>(.*)<\\/em:version>/<em:version>"+args.version+"<\\/em:version>/g' install.rdf")
    puts args.version
end

task :build do
    puts "Packaging FireFile #{version}"
    FileUtils.mkdir_p('xpi')
    FileUtils.rm_rf('xpi/firefile-#{version}.xpi')
    sh %{zip -r xpi/firefile-#{version}.xpi . -x@.zipignore}
end

task :createtag do
    sh %{git tag -a v#{version} -m "version #{version}"}
end
