# Blockbench-Tabula-Importer-Exporter
A simple Blockbench plugin that serves to allow importing and exporting of Tabula (.tbl) files to and from Blockbench. 
Exported Tabula files are intended to be used in Tabula version 10.5.1 for Minecraft Forge version 1.16.5, as well as for Minecraft mods such as Fisk's Superheroes.
## To install:
Download tbl_import_export.js from Releases. Open Blockbench, and find File -> Plugins -> Load Plugin from File, and select tbl_import_export.js
## How to use:
You should be able to import Tabula models for Modded Entity type projects in Blockbench through File -> Import -> Import Tabula Model (.tbl) Custom
You should also be able to export Modded Entity type projects in Blockbench as Tabula models through File -> Export -> Export to Tabula (.tbl) Custom
## Fixes:
* UV mirrors should now be imported/exported correctly
* Inflate can now be imported by calculating the minimum value of expandX, expandY, and expandZ of a cube
* Redundant group-cube pairs will now be condensed into a singular cube upon import (rotated group with a non rotated cube)
  * This will lead to a model that is exported and then imported back into Blockbench being identical to what it was prior to said exporting and importing
* Flipping across the X axis is now not needed before exporting and after importing
## Known Issues:
* Importing a TBL file from Tabula versions prior to version 5 with cube groups may result in broken imports
## Credits:
All credits for the original importer and exporter go towards the following authors:
* grillo78 - For the original Tabula exporter (https://github.com/grillo78)
* JTK222 - For the original Tabula importer (https://github.com/JTK222)
* Wither - For the original Techne importer that which the Tabula importer is based upon (https://github.com/GitWither)
