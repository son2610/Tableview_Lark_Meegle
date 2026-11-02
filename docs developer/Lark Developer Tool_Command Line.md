# Lark Developer Tool - Command Line

## Introduction
**Lark Developer Tools** is officially launched by Lark. It is a development tool for developers to develop ecological applications and enterprise self-built applications based on Lark’s open capabilities. Currently, it provides new projects, login, logout, Code package upload, real machine preview, feedback and other functions, more features are also in continuous iteration.

After installing the command line tool, the developer can use the ==opdev== command in the terminal.  
For example：
- Use ==opdev login== to login with Lark account;
- Use ==opdev preview== to preview the small program under development; 
- Use ==opdev upload== to upload the small program under development;

By reading the following documents, you can quickly understand the installation and daily use of this tool.

## Installation  

Command line installation, directly copy the following script to run in the terminal

```shell
npm i https://lf-package-sg.larksuitecdn.com/obj/lark-static-sgsaas/opdev/ide/cli/bdeefe-opdev-cli-saas-lark-3.4.4.tgz -gf
```warning
Installation using the command line requires Node.js. Please refer to [Node.js](https://nodejs.org) for the installation method. When you install Node.js, npm will be installed automatically.

- Node.js version check
```shell 
 $ node -v  
``` 
> Please ensure that the version number output by the above command is >= ==11.11.0==. If you need to use other versions of Node.js at the same time, you can use nvm in the same computer Manage multiple Node versions.

- NPM version check
```shell 
 $ npm -v  
``` 

### Verify that the installation is successful

After you choose the above two methods to install, please execute the following commands in the command line terminal to check whether the installation is successful:

```shell
$ opdev help
```
If the installation is normal, you will see the following output:   
```shell   
opdev: Lark Open Platform Developer Toolset

USAGE
  $ opdev [COMMAND]

COMMANDS
Account related
  login     Login with Lark account
  logout    Log out of the Lark account
  ....
```

You can also use the ==opdev version== command to check the tool version:   

```js
$ opdev --version
1.9.0
```

If you may encounter the following problems during the installation process, please check the following **FAQ**  

- [Encountered "permission denied" error during installation](https://open.larksuite.com/document/uYjL24iN/ugDM0YjL4ADN24COwQjN#Q%EF%BC%9A%E5%9C%A8%E5%AE%89%E8%A3%85%E7%9A%84%E8%BF%87%E7%A8%8B%E4%B8%AD%E9%81%87%E5%88%B0%E2%80%9Cpermission%20denied%E2%80%9D%E6%8A%A5%E9%94%99%E5%BA%94%E8%AF%A5%E5%A6%82%E4%BD%95%E8%A7%A3%E5%86%B3%EF%BC%9F)

- ["Xcodebuild" is required during the installation process](https://open.larksuite.com/document/uYjL24iN/ugDM0YjL4ADN24COwQjN#Q%EF%BC%9A%E5%9C%A8%E5%AE%89%E8%A3%85%E7%9A%84%E8%BF%87%E7%A8%8B%E4%B8%AD%E9%9C%80%E8%A6%81%E2%80%9Cxcodebuild%E2%80%9D%E5%BA%94%E8%AF%A5%E5%A6%82%E4%BD%95%E8%A7%A3%E5%86%B3%EF%BC%9F)

- [What should I do if it prompts "untrusted developer" when running the standalone installation package under macOS?](https://open.larksuite.com/document/uYjL24iN/ugDM0YjL4ADN24COwQjN#75e3d677)

## Features  
Lark Developer Tools provide project preview, upload, feedback and other functions around application projects. It also supports account management capabilities such as user login, logout, and tenant switching

### Commands

#### help  
All commands can be used ==help== to display related help information
```shell
# Display help information.
$ opdev help

# Display help for single command.
$ opdev upload --help
```

#### login  

The login state is a prerequisite for the use of upload gadget, preview gadet, login in the simulator and other related operations. This command will open your default browser to log in. If your browser has the login status of Lark Open Platform, you will be logged in to the current enterprise user by default, otherwise you need to scan the code to log in.
```shell
$ opdev login
```

#### logout  

Logout Lark account.

```shell
$ opdev logout
```

#### tenant switch  

Switch tenants under the current login account（v1.2.0 + suported）

```shell
$ opdev tenant switch
```

#### preview

Gadget preview    
The mobile terminal uses Lark to scan and preview the QR code to open the gadget preview interface, and the PC terminal enters the interface through the preview message card issued by the "Developer Assistant" robot.

> The gadget preview depends on the following conditions:
> 1. The Lark account login has been completed through the ==opdev login== command or the simulator interface;
> 2. Configuration in the application project==project.config.json==Fill in the correct appId, reference for obtaining the appId [document](https://open.larksuite.com/document/home/develop-a-gadget-in-5-minutes/create-a-custom-app)
> 3. If the PC version of Lark >= ==3.41==, please use the developer tools version 1.10.0 and above, and add the ==-i== parameter in the preview to open the debug panel. For example: ==opdev preview ./ -p pc -i==

The instructions to execute the preview are as follows:
```shell
$ opdev preview [project-path] --platform=mobile
# OR
$ opdev preview [project-path] -p mobile
```

##### Real-time preview

Monitor file changes and preview the updated gadget directly on the client (currently only supports mobile terminals)  
Commands：
```shell  
$ opdev preview [project-path] --platform=mobile --watch
# OR
$ opdev preview [project-path] -p mobile -w
```

#####  Specify the start page when previewing

Specify the startup page and startup parameters when previewing (v1.2.0+ support)

```shell
opdev preview [project-path] --platform=mobile --startPage 'page/index/index?title="hello"'
# OR
opdev preview [project-path] -p mobile -s 'page/index/index?title="hello"'
```

#### upload  
After the development is completed, upload the small program code package to the developer backend.

> The code package upload depends on the following conditions:
> 1. The Lark account login has been completed through the ==opdev login== command or the simulator interface; 
> 2. Configuration in the application project ==project.config.json== filled in the correct appId, reference for obtaining the appId [document](https://open.larksuite.com/document/home/develop-a-gadget-in-5-minutes/create-a-custom-app#2.%20%E6%9F%A5%E7%9C%8B%E5%BA%94%E7%94%A8%E7%9A%84%20App%20ID)    
> 
> Note: v1.4.0 and above support the upload of small components, no platform is required

Command：
```shell
$ opdev upload [project-path] --platform=pc --version=[v] --description=[desc]
# OR
$ opdev upload [project-path] -p pc -v [version] -d [desc]
# Must fill in the legal version number, for example: 1.0.0, and must be greater than the previous version
```

Upload the mobile main navigation bar gadget to the developer backend

```shell
$ opdev upload [project-path] --type=gadget-nav --platform=mobile --version=[v] --description=[desc]
# OR
$ opdev upload [project-path] -t gadget-nav -p mobile -v [v] -d [desc]
```

#### feedback  
When you encounter problems during the development process and need help, you can use this command to open the feedback entry.
```shell
$ opdev feedback
```

### token
In scenarios where `login` cannot be invoked, the tool provides the `token` command, which allows users to carry user information using a Token to invoke commands such as `preview`, `upoad`, etc.

First, create a token:

```shell
opdev token create
# Token generated successfully:
# 00000000-0000-0000-0000-000000000000
```

Then set the environment variables based on this token:

```shell
export OPDEV_TOKEN=00000000-0000-0000-0000-000000000000
export OPDEV_ENV=lark #Optional (The default value is "lark.")
```

Finally, run commands ==preview== and ==upload==:

```shell
opdev preview ./ -p mobile
```

Or add the environment variable before the command:
```shell
OPDEV_TOKEN=xxx-xxx-xxx  OPDEV_ENV=lark opdev preview ./ -p mobile
```

> Note: After you set the environment variable ==OPDEV_TOKEN==, the ==opdev login|logout|whoami|token|tenant== commands in the current terminal will become invalid, but will not be affected in other terminals.
