# Configuration of c_cpp_properties.json file

The [C/C++ Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) is used to provide C and C++ syntax highlight, code navigation and Go to declaration/definition within C and C++ files.
The default configuration file is located in `{PROJECT_DIR}/.vscode/c_cpp_properties.json` and can be generated by using **ESP-IDF: Create project from extension template** command or using the **ESP-IDF: Add vscode configuration folder** command.

## Why configure this file?

To enable Code Navigation, auto-complete and other language support features on ESP-IDF source files on Visual Studio Code. Please take a look at [C/C++ Configurations](https://code.visualstudio.com/docs/cpp/config-linux#_cc-configurations) for more detail about c_cpp_properties.json configuration fields.

## Default Configuration with compile_commands.json

For the default configuration, you must build your project beforehand in order to generate `${workspaceFolder}/build/compile_commands.json` (where \${workspaceFolder} is your project directory). This file will then be used to resolve your C/C++ headers.

```json
{
  "configurations": [
    {
      "name": "ESP-IDF",
      "compilerPath": "/path/to/toolchain-gcc",
      "compileCommands": "${workspaceFolder}/build/compile_commands.json",
      "includePath": [
        "${config:idf.espIdfPath}/components/**",
        "${config:idf.espIdfPathWin}/components/**",
        "${config:idf.espAdfPath}/components/**",
        "${config:idf.espAdfPathWin}/components/**",
        "${workspaceFolder}/**"
      ],
      "browse": {
        "path": [
          "${config:idf.espIdfPath}/components",
          "${config:idf.espIdfPathWin}/components",
          "${config:idf.espAdfPath}/components/**",
          "${config:idf.espAdfPathWin}/components/**",
          "${workspaceFolder}"
        ],
        "limitSymbolsToIncludedHeaders": false
      }
    }
  ],
  "version": 4
}
```

> **NOTE:** When you create a project using the extension commands such as `Show Examples Projects`, `New Project`, `Create project from extension template` or you add the configuration files to an existing project using the `Add vscode configuration folder`, this file is created with the compilerPath of the configured toolchain for your current `idf.adapterTargetName`.

## Recursive search configuration

With this configuration, the IntelliSense engine of the C/C++ extension will include all header files found by performing a recursive search of the `${config:idf.espIdfPath}/components` folder.
For this configuration to work, you need to set you C/C++ Extension IntelliSense engine to **Tag Parser** by using `C_Cpp.intelliSenseEngine": "Tag Parser"` in your settings.json and remove the `"compileCommands": "${workspaceFolder}/build/compile_commands.json"` property from the `c_cpp_properties.json`. Example:

```json
{
  "configurations": [
    {
      "name": "ESP-IDF",
      "compilerPath": "/path/to/toolchain-gcc",
      "includePath": [
        "${config:idf.espIdfPath}/components/**",
        "${config:idf.espIdfPathWin}/components/**",
        "${config:idf.espAdfPath}/components/**",
        "${config:idf.espAdfPathWin}/components/**",
        "${workspaceFolder}/**"
      ],
      "browse": {
        "path": [
          "${config:idf.espIdfPath}/components",
          "${config:idf.espIdfPathWin}/components",
          "${config:idf.espAdfPath}/components/**",
          "${config:idf.espAdfPathWin}/components/**",
          "${workspaceFolder}"
        ],
        "limitSymbolsToIncludedHeaders": false
      }
    }
  ],
  "version": 4
}
```
