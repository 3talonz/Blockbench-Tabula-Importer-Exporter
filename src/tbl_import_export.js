/**
MIT License

Copyright (c) 2025 3Talonz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
**/
(function () {
    /** ---------- Condense Extra Groups ---------- */
    // tiny vec3 zero-check
    function isZero3(v) {
        return Math.abs(v[0]) < 1e-9 && Math.abs(v[1]) < 1e-9 && Math.abs(v[2]) < 1e-9;
    }

    // if group is just rotated wrapper around one cube, collapse it
    function condenseRotatedGroupCube(group, parentGroup) {
        // only 1 child, child is cube, group has only 1 box (1 child cube after import), same name as cube, cube rotation == [0,0,0], cube origin == [0,0,0]
        if (!group || !group.children || group.children.length !== 1) return; 
        const child = group.children[0];
        if (!(child instanceof Cube)) return; 
        if (group.name !== child.name) return;
        if (!isZero3(child.rotation)) return;
        if (!isZero3(child.origin)) return;

        // Copy group’s pivot + rotation to cube
        child.origin[0] = group.origin[0];
        child.origin[1] = group.origin[1];
        child.origin[2] = group.origin[2];
        child.rotation[0] = group.rotation[0];
        child.rotation[1] = group.rotation[1];
        child.rotation[2] = group.rotation[2];

        // Reparent cube to the group's parent, keep outliner order if possible
        let insertIndex;
        if (parentGroup) {
            insertIndex = parentGroup.children.indexOf(group);
            try { child.addTo(parentGroup, Math.max(0, insertIndex)); }
            catch (_) { child.addTo(parentGroup); }
        } else {
            // root-level
            insertIndex = Project.outliner.indexOf(group);
            try { child.addTo(null, Math.max(0, insertIndex)); }
            catch (_) { child.addTo(); }
        }
        // Remove old wrapper group
        group.remove();
    }

    /** ---------- Flipper ---------- */
    function flipX(roots) {
        const groups = [];
        const cubes = [];

        function collect(node) {
            if (node instanceof Group) {
                groups.push(node);
                (node.children || []).forEach(collect);
            } else if (node instanceof Cube) {
                cubes.push(node);
            }
        }

        if (!roots) {
            (Project.outliner || []).forEach(collect);
        } else {
            (Array.isArray(roots) ? roots : [roots]).forEach(collect);
        }

        groups.forEach(group => {
            group.origin[0] = -group.origin[0];
            group.rotation[1] = -group.rotation[1];
            group.rotation[2] = -group.rotation[2];
        });

        cubes.forEach(cube => {
            const newFromX = -cube.to[0];
            const newToX = -cube.from[0];
            cube.from[0] = Math.min(newFromX, newToX);
            cube.to[0] = Math.max(newFromX, newToX);

            cube.origin[0] = -cube.origin[0];
            cube.rotation[1] = -cube.rotation[1];
            cube.rotation[2] = -cube.rotation[2];

            cube.mirror_uv = !cube.mirror_uv;
        });
    }

    /** ---------- Export - Tabula ---------- */
    var exportTabula = new Action('bb_to_tbl', {
        name: 'Export to Tabula (.tbl) Custom',
        description: 'Export Tabula model',
        icon: 'bar_chart',
        category: "file",
        condition: () => Format.id === Formats.modded_entity.id,
        click: function () {
            //flip before exporting to match tabula's coordinate system
            flipX();
            var parts = [];
            Project.outliner.forEach(element => {
                if (element.export)
                    parts.push(groupToFolder(element));
            });
            var outputBody = {
                author: "",
                projVersion: 5,
                notes: [],
                scaleX: 1.0,
                scaleY: 1.0,
                scaleZ: 1.0,
                texWidth: Project.texture_width,
                texHeight: Project.texture_height,
                textureFile: "texture.png",
                parts: parts,
                identifier: "",
                name: Project.name,
            }
            var zip = new JSZip();
            zip.file("model.json", JSON.stringify(outputBody));
            var tex = Texture.getDefault();
            zip.file("texture.png", tex.getBase64(), {
                base64: true
            });
            zip.generateAsync({
                type: "blob"
            })
                .then(function (content) {
                    Blockbench.export({
                        savetype: "zip",
                        extensions: ['tbl'],
                        name: 'model.tbl',
                        content: content,
                    });
                });
            //flip back after exporting to restore model orientation in Blockbench
            flipX();
        }
    });

    function groupToFolder(group) {
        var cubes = [];
        var childrens = [];
        group.children.forEach(children => {
            if (children instanceof Cube) {
                if (children.selected)
                    console.log(children);
                if (!children.mirror_uv && children.rotation[0] == 0 && children.rotation[1] == 0 && children.rotation[2] == 0)
                    cubes.push(cubeToTblCube(children));
                else
                    childrens.push(cubeToFolder(children))
            }
            if (children instanceof Group) childrens.push(groupToFolder(children));
        });
        var folder = {
            texWidth: Project.texture_width,
            texHeight: Project.texture_height,
            matchProject: true,
            texOffX: 0,
            texOffY: 0,
            rotPX: group.origin[0] - (group.parent instanceof Group ? group.parent.origin[0] : 0),
            rotPY: (group.parent instanceof Group ? group.parent.origin[1] : 24) - group.origin[1],
            rotPZ: group.origin[2] - (group.parent instanceof Group ? group.parent.origin[2] : 0),
            rotAX: -group.rotation[0],
            rotAY: group.rotation[1],
            rotAZ: -group.rotation[2],
            mirror: !group.mirror_uv,
            showModel: group.visibility,
            boxes: cubes,
            children: childrens,
            identifier: "",
            name: group.name,
        }
        return folder;
    }

    function cubeToFolder(cube) {
        var folder = {
            texWidth: Project.texture_width,
            texHeight: Project.texture_height,
            matchProject: true,
            texOffX: 0,
            texOffY: 0,
            rotPX: cube.origin[0] - cube.parent.origin[0],
            rotPY: cube.parent.origin[1] - cube.origin[1],
            rotPZ: cube.origin[2] - cube.parent.origin[2],
            rotAX: -cube.rotation[0],
            rotAY: cube.rotation[1],
            rotAZ: -cube.rotation[2],
            mirror: !cube.mirror_uv,
            showModel: cube.visibility,
            boxes: [cubeToTblCube(cube, cube)],
            children: [],
            identifier: "",
            name: cube.name,
        }
        if (cube.selected)
            console.log(folder);
        return folder;
    }

    function cubeToTblCube(cube, parent) {
        if (!parent)
            parent = cube.parent;
        var tblCube = {
            posX: cube.from[0] - parent.origin[0],
            posY: parent.origin[1] - cube.to[1],
            posZ: cube.from[2] - parent.origin[2],
            dimX: cube.to[0] - cube.from[0],
            dimY: cube.to[1] - cube.from[1],
            dimZ: cube.to[2] - cube.from[2],
            expandX: cube.inflate,
            expandY: cube.inflate,
            expandZ: cube.inflate,
            texOffX: cube.uv_offset[0],
            texOffY: cube.uv_offset[1],
            identifier: "",
            name: cube.name,
        }
        return tblCube;
    }

    /** ---------- Import - Tabula ---------- */

    function loadZipToJson(importType) {
        Blockbench.import({
            type: importType.extension + ' File',
            extensions: [importType.extension],
            readtype: 'binary'
        }, (files) => {
            let data = files[0].content;
            var loadedZip = new JSZip().loadAsync(data);
            loadedZip.then(zip => {
                zip.file(importType.file).async("string")
                    .then(json => {
                        console.log(importType);
                        importType.import(json);
                    });

                if (importType == ImportTypeEnum.TBL) {
                    if (zip.file(importType.texture))
                        zip.file(importType.texture).async("base64").then(img => {
                            var texture = new Texture().fromDataURL('data:image/png;base64,' + img);

                            texture.add();
                        });
                } else {
                    if (zip.file(importType.texture))
                        zip.file(importType.texture).forEach(pr => {
                            pr.async("base64").then(img => {
                                var texture = new Texture().fromDataURL('data:image/png;base64,' + img);

                                texture.add();
                            });
                        });
                }
            });
        });
    }

    var ImportTypeEnum = {
        TBL: {
            extension: 'tbl',
            file: 'model.json',
            texture: 'texture.png',
            import: loadTabulaModel
        }
    }

    var importTabula = new Action({
        id: 'import_tabula',
        name: "Import Tabula Model (.tbl) Custom",
        icon: 'flip_to_back',
        description: 'Import Tabula Model',
        category: 'file',
        condition: () => Format.id === Formats.modded_entity.id,
        click: function (event) {
            loadZipToJson(ImportTypeEnum.TBL);
        }
    });

    function loadTabulaModel(data) {
        Undo.initEdit({
            outliner: true,
            bitmap: true,
            uv_mode: true
        });
        var json = JSON.parse(data);

        var version = json.projVersion || 0;

        switch (version) {
            case 5:
                Project.name = json.modelName;
                Project.texture_width = json.texWidth;
                Project.texture_height = json.texHeight;
                json.parts.forEach(part => readTblBone(part, version, null));
                // Blockbench.showMessageBox({
                //     title: "Warning",
                //     message: "You imported a version 5 Tabula Model.\nThis Format has some functions which are not supported by Blockbench, for this reason some things might have broken on import."
                // });
                break;
            default:
                Project.name = json.modelName;
                Project.texture_width = json.textureWidth;
                Project.texture_height = json.textureHeight;
                var rootGroup = new Group(
                    {
                        name: "root",
                        origin: [0, 24, 0],
                        rotation: [0, 0, 0],
                    }
                ).addTo();
                rootGroup.init();
                if (json.cubeGroups){
                    Blockbench.showMessageBox({
                    title: "Warning",
                    message: "Tabula Model version <5 with cubeGroups(Folders) detected.\nThese as well as all child groups/cubes cannot be properly imported at the moment and may have resulted in a broken import.\nPlease consider importing a model without cubeGroups"
                    });
                }
                // json.cubeGroups.forEach(bone => readTblBone(bone, version, rootGroup)); // currently line doesn't do anything because it cannot build proper hierarchy
                json.cubes.forEach(cube => readTblBone(cube, version, rootGroup));
                break;
        }
        //flip model to correct orientation before displaying to interface
        flipX();

        Undo.finishEdit('Import Tabula Model');
        Canvas.updateAll();
    }

    function readTblBone(json, version, parentGroup) {
        var group;
        switch (version) {
            case 5:
                group = new Group({
                    name: json.name,
                    origin: [(parentGroup == null ? 0 : parentGroup.origin[0]) + json.rotPX, (parentGroup == null ? + 24 : parentGroup.origin[1]) - json.rotPY, (parentGroup == null ? 0 : parentGroup.origin[2]) + json.rotPZ],
                    rotation: [-json.rotAX, json.rotAY, -json.rotAZ]
                });
                break;
            case 2:
                group = new Group({
                    name: json.name,
                    //origin: [parentGroup.origin[0] + json.position[0], parentGroup.origin[1] - json.position[1], parentGroup.origin[2] + json.position[2]],
                    origin: [parentGroup.origin[0] + (json.position[0] / json.scale[0]), parentGroup.origin[1] - (json.position[1] / json.scale[1]), parentGroup.origin[2] + (json.position[2] / json.scale[2])],
                    rotation: [-json.rotation[0], json.rotation[1], -json.rotation[2]],
                });
                break;
            default:
                group = new Group({
                    name: json.name,
                    //origin: [parentGroup.origin[0] + json.position[0], parentGroup.origin[1] - json.position[1], parentGroup.origin[2] + json.position[2]],
                    origin: [parentGroup.origin[0] + (json.position[0] / json.scale[0]), parentGroup.origin[1] - (json.position[1] / json.scale[1]), parentGroup.origin[2] + (json.position[2] / json.scale[2])],
                    rotation: [-json.rotation[0], json.rotation[1], json.rotation[2]],
                });
                break;
        }
        if (parentGroup) group.addTo(parentGroup);
        group.init();

        switch (version) {
            case 5:
                if (json.children) json.children.forEach(bone => readTblBone(bone, version, group));
                if (json.boxes) json.boxes.forEach(cube => readTblCube(cube, version, group, json));
                break;
            default:
                if (json.children) json.children.forEach(bone => readTblBone(bone, version, group));
                readTblCube(json, version, group);
                break;
        }
        // new condensing step
        condenseRotatedGroupCube(group, parentGroup);
    }
    function readTblCube(json, version, parentGroup, extra) {
        var cube;
        switch (version) {
            case 5:
                var pos = [json.posX, json.posY, json.posZ];
                var dim = [json.dimX, json.dimY, json.dimZ];
                cube = new Cube({
                    mirror_uv: !extra.mirror,
                    name: json.name,
                    from: [parentGroup.origin[0] + pos[0], parentGroup.origin[1] - pos[1] - dim[1], parentGroup.origin[2] + pos[2]],
                    to: [parentGroup.origin[0] + pos[0] + dim[0], parentGroup.origin[1] - pos[1], parentGroup.origin[2] + pos[2] + dim[2]],
                    inflate: Math.min(json.expandX, json.expandY, json.expandZ),
                    uv_offset: [extra.texOffX + json.texOffX, extra.texOffY + json.texOffY]
                });
                break;
            default:
                cube = new Cube({
                    mirror_uv: !json.txMirror,
                    name: json.name,
                    from: [parentGroup.origin[0] + json.offset[0], parentGroup.origin[1] - json.offset[1] - json.dimensions[1], parentGroup.origin[2] + json.offset[2]],
                    to: [parentGroup.origin[0] + json.offset[0] + json.dimensions[0], parentGroup.origin[1] - json.offset[1], parentGroup.origin[2] + json.offset[2] + json.dimensions[2]],
                    inflate: json.mcScale,
                    uv_offset: [json.txOffset[0], json.txOffset[1]],
                });
                break;
        }
        if (parentGroup) cube.addTo(parentGroup);
        cube.init();
    }

    function isValidVersion() {
        var versions = Blockbench.version.split(".");
        return versions[0] >= 3 && versions[1] >= 1;
    }

    Plugin.register('tbl_import_export', {
        title: 'TBL Import/Export',
        author: '3Talonz(Fixes), grillo78 (Export), JTK222 (Import), Wither (original Techne import)',
        icon: 'fa-cubes',
        description: 'Allows importing and exporting of Tabula files',
        tags: ["Minecraft: Java Edition"],
        version: '1.8.0',
        variant: 'desktop',

        onload() {
            if (isValidVersion) {
                MenuBar.addAction(importTabula, 'file.import');
                MenuBar.addAction(exportTabula, 'file.export');
            }
            else {
                Blockbench.showMessageBox({
                    title: 'Incompatible Blockbench Version',
                    message: 'The TBL Import/Export plugin requires Blockbench version 3.1 or higher to function properly. Please update Blockbench to use this plugin.'
                });
            }
        },
        onunload() {
            if (isValidVersion) {
                importTabula.delete();
                exportTabula.delete();
            }
        }
    });

})();