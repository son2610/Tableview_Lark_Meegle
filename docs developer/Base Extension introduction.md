# Introduction to Lark Base Open Platform

> **Lark Base is an advanced team's business management tool.** **It** **is not only a table but also countless applications, catering to the unique needs of each individual and providing numerous solutions for thousands of users.**
> 
<br>
Based on the flexible and user-friendly features of the Lark Base, a large number of users have utilized it to build systems of various sizes, such as project management systems, customer management systems, and inspection systems. Meanwhile, users have also expressed the need for additional expanded functionalities for the Base. To meet these demands, the Lark Base team keeps shipping new features and we are also building an open platform and welcoming ISV developers and enterprise IT developers to join us in expanding the capabilities of Lark Base.
Within the open ecosystem of Lark Base, developers can:
- Leverage the powerful extensibility to unleash their imagination and develop innovative applications.
- Engage in discussions and collaborate with the Lark Base product and technical team for mutual progress.
- Enterprise IT developers can quickly expand the capabilities of Lark Base and explore new application scenarios by developing custom applications for their organizations.
- ISV developers have the opportunity to reach a vast customer base and gain insights into real business requirements. They can also collaborate with the Lark commercial team for better and faster product sales.

## Lark Base open mode

1. **What kind of open capabilities does Lark Base provide?**

We offer two open capabilities: OpenAPI and Base extensions

**OpenAPI**

Developers can use OpenAPI to control a Base metadata definition, read and write data, control views, and control permissions

See: [Overview - server docs - Development Document - Lark Open Platform](https://open.larksuite.com/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/bitable-overview)

**Base extension**
    - Multiple open interfaces that allow developers to directly embed their own developed products within Base
    - Extension marketplace and template replication and distribution capabilities, making it convenient for developers to promote and reuse their extensions.
2. **Which open capability should I use?**
    - If you want to implement data connectivity between your own system and Base, or want to perform basic data operations on a Base, you can try OpenAPI
    - If you want to develop a new feature on Base, especially if you want your feature to be distributed and used by more people, we strongly recommend that you try the Base extension
    - Of course, you can also freely combine the two open capabilities to develop powerful Base applications

Below we give a detailed description and case demonstration of the Base extension

## Detailed explanation of Base extension

The open interfaces of the Base are divided into three categories: Model & Data, Views, and Logic. Each category contains various specific interfaces. Let's provide a detailed explanation of these different interfaces with the help of diagrams and examples, allowing everyone to quickly understand the functionality of each interface.
| **Type**                                | **Extension Interface**                                                                                                                                                                                                                                       | **Extension Examples**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **View**                                | **Record view extension** ***Released***                                                                                                                                                                                                                      | Extension for typesetting and printing![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/70a32d62253ffc7466d725fd070507b4_wlEse3tckr.png?height=1670&lazyload=true&width=3286)                                                                                                                                                                                                                                   |
| **Table view extension** ***Released*** | Map view![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/2bdcbd9752f3e5d78e935d8291b2a695_xhmShKGMLg.png?height=1496&lazyload=true&width=2934) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Logic**                               | **Automation Action** ***Released***                                                                                                                                                                                                                          | Email via Outlook Action![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/4ea371027133f92fdad2db2ba0f4ca8c_9miyNbNj9O.png?height=1776&lazyload=true&width=2332)                                                                                                                                                                                                                                                 |
| **Model & Data**                        | **Data connector** In development                                                                                                                                                                                                                            | Jira Data Connector![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/985606fb5dc40cc6af305bb6bb3a6951_mwrExjzfmY.png?height=1330&lazyload=true&width=2338)![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/bc07da9b5ffb5f6042eb10a7085d3fc8_YelIhmF6o6.png?height=1364&lazyload=true&width=2336) |

## Experience the Base extension

**"DocuGenius"** : The extension can quickly format data in Base into professional-looking documents. All data in the table can be exported as print-ready documents using templates after a single formatting.
[Install Link](http://app.larksuite.com/app/cli_a4d1b87a54f8d00a)
<br><br>
**"Lark Card Extraction"** :
Understand and structure corporate documents to create business automation processes
[Install Link](https://app.larksuite.com/app/cli_a49a84bd1e78d00a)
<br><br>
**"Email via Outlook"** :
「Email via Outlook」extension allows you to trigger the Outlook service to send emails to the respective users through the automation feature of the Base.
[Install Link](https://app.larksuite.com/app/cli_a403e6f10bb9d00a)

# Multidimensional table data table view development guide

# Step 1: Create a plugin application

## Steps

1. Log in to [Lark Developer Background](https://open.larksuite.com/app).
1. On the homepage of the developer background, click **Create self-built application**, fill in the application name, description, and icon information, and then click **Create**.

![创建应用.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/6ee9613f86b0b7ad099cbc208f427ca9_NKYZV5ifxk.png?height=1742&lazyload=true&width=2494)

> This guide takes an **enterprise self-built application** as an example to introduce how to develop a multidimensional tabular data table view. If you want to create an app for different companies, you can choose **Create Store App**. To create a store application, please refer to [1. Service provider registration](https://open.larksuite.com/document/uMzNwEjLzcDMx4yM3ATM/uUzNwEjL1cDMx4SN3ATM)。For more detailed differences and introductions between **Store Apps** and **Enterprise Self-built Apps**, please refer to [Application Type Introduction - Quickly understand the application types in Lark - Development Documentation - Lark Open Platform](https://open.larksuite.com/document/home/app-types-introduction/overview)。

3. Click **Add Application Capability** on the left, select **Multidimensional Table Add-In** , select **Data Table View**, and finally click **+Add**.

![添加应用能力.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/7dbb258ebd6ef75eaf8ce31f0ea86145_oCTft9Mxjf.png?height=1738&lazyload=true&width=3078)

![1.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/26e398bdf1818c5ea0654e9946d986ee_9TkgQVBqDK.png?height=1566&lazyload=true&width=2788)

4. Record the App ID and BlockTypeID.
On the created page, record the BlockTypeID, switch to **Credentials and Basic Information**, and record the App ID. App ID and BlockTypeID will be used for project initialization.

![2.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/cd44be3d07cbd1d7b8e80d38660b10b9_z6ldZu7YeE.png?height=1702&lazyload=true&width=2940)

![46.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/c1cfc3b5330da2c5e26769dd8db257fe_kao94WvDfd.png?height=1196&lazyload=true&width=2946)

# Step 2: Build a development environment

You need to install the Lark developer tools locally and use the tools to initialize the automation plugin project.

## Steps

1. Install the CLI.
```
npm install @lark-opdev/cli@latest -g -f
```
> For detailed usage and commands of the CLI, please refer to: [Lark Developer Tools - Command Line](https://open.larksuite.com/document/uYjL24iN/uEzMzUjLxMzM14SMzMTN/ide-with-commands).
2. Log in to the CLI.
- The first time you use the CLI, you need to log in. Open the terminal and execute the following command `opdev login` to log in to the CLI.

- Select `Lark` for the development environment here:

![cli登陆.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/518971a6fc6cbdcef4e3484fc70a06a4_fV5jZz0KSq.png?height=264&lazyload=true&width=1680)

- After selecting the development environment, the browser scan code login page will be opened automatically, please log in according to the instructions.

- After scanning the code and logging in, the command line will prompt that the login is successful:

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/d09ec83ffa1cff6b5afba3ffde0f46d9_McqybeIn86.png?height=100&lazyload=true&width=734)

3. Create a project. Create a template project with the following command:
    - app-dir needs to be replaced with the directory name of your project.
    - view-dir needs to be replaced with the directory name of your plugin.
         ```
         opdev create ${app-dir}/${view-dir} -a bitable-extensions -s table-view
         ```
    The creation process will ask `Do you need to create a new application?`
    - If you select `No`, you will be asked to fill in the ID information obtained in step 1: App ID and BlockTypeID. You can also modify the blockTypeID in the block.json file and the appId in the app.json file in the created project, so that the code can be used for your other application plugins.For detailed descriptions of these two files, please refer to the **Principles of Code Uploading and Secondary Development** in the issue collection in this article.

![8.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/34ab2a6658ff74426b67b92c0e9bf50a_fgM8O0me2u.png?height=226&lazyload=true&width=1136)

> The generated template is a React Demo Project that conforms to the NPM Module definition.
    >
    > The `blockTypeID` field in the `block.json` file of the generated template is the BlockTypeID filled in the command line during initialization.
    >
    > The `appId` in the `app.json` file is the App ID filled in the command line during initialization.
    - Select Yes, if you do not have ISV qualification, a **Enterprise Self-built Application** and a **View Plugin** will be created automatically.

![10.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/013a305f86afcae1bcc3b93e250f4a07_V5PG2McI8B.png?height=206&lazyload=true&width=1648)

If you have an ISV qualification, you can choose to create a store application `Store Apps`, or an enterprise self-built application `Custom Apps`.

4. Initialize the project.
Install project dependencies with the following command:
```
cd ${app-dir}/${view-dir} 
npm install
```

# Step 3: Debugging

The project created by default uses React + Typescript + Webpack as the development environment; you can also choose the development environment you are used to, such as Vue; but please keep using Webpack for development and install [@lark-opdev/block-bitable-webpack-utils](https://www.npmjs.com/package/@lark-opdev/block-bitable-webpack-utils)。

## Steps

1. Execute the following command to start WebpackDevServer to enter development and debugging.
```
npm run start
```
It will automatically open a multi-dimensional table document for you, and bring the debug parameter of `debugPort=${current application port}`.

2. In the multidimensional table page that opens, click the **New View button**.

![3.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/708a9b23f306273e72911cbfd5ca4f19_inFZaaL7cn.png?height=1788&lazyload=true&width=2126)

3. Or click **Add more plugins**.

![4.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/a8cffa2c561cba76f5fc7ae5a9b599d9_oTMUANRWxk.png?height=1382&lazyload=true&width=1406)

4. Select the component you developed locally (usually blk_xxx), and click **+** **Add extensions**.

![11.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/ebc8020aea73d744eeeb8297d5b6c753_PWbNSHXV7V.png?height=772&lazyload=true&width=1400)

5. Debug your plugin in a new tab.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/7da3741b097b71837481f2be5d0b5cf8_5DcybqegYy.png?height=1738&lazyload=true&width=2914)

## Call the API through the SDK

We provide some API capabilities through the [@lark-opdev/block-bitable-api](https://www.npmjs.com/package/@lark-opdev/block-bitable-api) SDK, which can read and write Bitable data.  please refer to API list。
```

import { bitable } from "@lark-opdev/block-bitable-api";
const tableMetaList = await bitable.base.getTableMetaList();
```

## Apply for the permissions corresponding to the API

1. API calls are controlled by permissions. Please enter the developer background according to the call permissions required by the specific API, find the **Permission Management** page, and search for the corresponding permissions.

![47.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/8eb2efa8d88e81839375a233dbe35063_uXnwLN1ifi.png?height=1904&lazyload=true&width=2894)

2. Click the **Add** button.

3. Republish the app once, the permission you just applied for can be seen in the version details, and the permission will take effect after the application is grayed out.

![48.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/a5c0b0312ae366fe7e74e46962ca705f_Oz6Hgpb3gI.png?height=2020&lazyload=true&width=2800)

## Optimize debugging

If you want to replace the open multidimensional table document, you can change the `url` property in `block.json`.
```
{
  "manifestVersion": 1,
  "blockTypeID": "blk_6412ffb4a38040143c2d8bc5",
  "projectName": "table_view",
  "url": "https://example.feishu.cn/base/KjeXbOX7CaR8CgsZVNGbKHCOcMh?table=tbl6u74iovfeA9aC&view=vewkevI7IE"
}
```
If you expect to open the multidimensional table with a fixed v or vb, you can add the following properties in `debug.json`:
> The simple understanding of v/vb is the version of the multi-dimensional table. By specifying different version numbers, some functions that are not yet online can be debugged in advance.
```
{
  "v": "1.0.1.xxxx",
  "vb": "1.0.0.xxxx"
}
```

# Step 4: Publish and install

## publish

1. Upload code
You can use the following commands to compile and upload:
```
npm run upload
```
You can also use the following command to upload only:
```
opdev upload ./dist
```
During the upload process, you need to enter the **plugin version number**, please use the semantic version like `0.0.1`, and ensure that the version is incremented.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/c5de5fee643f17a072f933efc0be180d_m5Q2JVFSSC.png?height=132&lazyload=true&width=852)

2. Re-enter the developer background and switch to **Data Table View**. **Widget** **Version** Select the version number filled in when you just uploaded, then upload the icon, fill in the name and introduction. Finally click **Save**.

![6.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/1852aa67ae8cf4d714bf86040c49caeb_MBsf1zLOmz.png?height=1996&lazyload=true&width=2814)

> Here we take the release process of **Enterprise Self-built Application** as an example. If you are using **Store App**, you need to pay attention to the strict review process for merchant release. For detailed process, please refer to[Step1 ISV Registration](https://open.larksuite.com/document/uMzNwEjLzcDMx4yM3ATM/uUzNwEjL1cDMx4SN3ATM)。
3. Publish
	- Switch to **Version Management and Publishing**. Then click **Create Version**。
![7.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/bee1bff50c857e742204223a41344e7c_5yo9WFdIji.png?height=1582&lazyload=true&width=2940)

- Fill in **Application Version Number**, **Update Description** (Note: The version here is the application version, and an application may have multiple plugins)。
![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/0914f85814701e0cdeb0f9826f22d387_gWBldkuuFx.png?height=2148&lazyload=true&width=2916)

- Confirm the permission and visibility scope, and click **Save** after confirmation。
	- Click **Submit for release** and wait for the administrator to review。
![9.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/04e7175e85c0417a3053b16a684084f4_A4U8sUbblD.png?height=1834&lazyload=true&width=2938)

## Install

Here we take an enterprise self-built application as an example. After the application is approved, users can see that your plug-in can be installed in the multi-dimensional table plug-in view.
Click the Add Plugin button:
![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/5e88872f1c8cfd32d13d3f22b28227c6_dMmnoWOk0i.png?height=1678&lazyload=true&width=2884)
After adding, you can see your application in the plug-in view of the multidimensional table:
![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/60176979eacad86d3560c7e198057849_UaSivDBzGK.png?height=1778&lazyload=true&width=2910)

# Problem sorting

## Q: The principle of code upload and secondary development
When executing npm run upload, the development tool @lark-opdev/cli will search for app.json at the same level as the directory where the command is executed, and identify the appId field in it. The meaning of appId is your application in the open platform. If you want to upload the code to other applications, you can modify the appId field in app.json to the appId of the target application.

![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/c3df0a9a152659e81eff8df95630acbe_HRsh1Kdwca.png?lazyload=true&width=2038&height=750)

Next, the blockTypeID will be found in block.json in the directory below the execution of this command. The blockTypeID here is the BlockTypeID of an application capability in the application (the application corresponding to the appId).

It should be noted that the type of application capability needs to correspond to the template type of the code. For example, the blockTypeID in the automation plug-in code can only be filled in with the BlockTypeID of the **Multidimensional Form Automation Operation** type in the open platform, but cannot be filled in as the **Multidimensional Form Record. BlockTypeID of view ** or ** multidimensional tabular data table view **.

![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/0672ed071f25cf4c145b74e9074f53b8_1wjdHsCFEP.png?lazyload=true&width=2590&height=840)

Then @lark-opdev/cli will find the target application that needs to be uploaded based on the appId in app.json in the currently logged in user's application, and then find the corresponding application capability under the application based on the blockTypeID, and finally upload the code to the application capability. .

If you want to upload the code to other application capabilities, you can directly modify these two files and then execute `npm run upload`.

If the upload fails, you can use the `opdev whoami` command to view the current logged in user. Make sure that the current user's open platform has the application corresponding to the appId in app.json, and the application has the application capability corresponding to the blockTypeID in block.json.

# Multidimensional table record view development guide

# Step 1: Create a plugin application

## Steps

1. Log in to [Lark Developer Background](https://open.larksuite.com/app)。
1. On the homepage of the developer background, click **Create self-built application**, fill in the application name, description and icon information, and then click **Create**。

![创建应用.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/6ee9613f86b0b7ad099cbc208f427ca9_9AcPqZ1wd5.png?height=1742&lazyload=true&width=2494)

> This guide takes the **enterprise self-built application** as an example to introduce how to develop a multi-dimensional table record view plug-in. If you want to create an app for different companies, you can choose **Create Store App**. To create a store application, please refer to [1. Service provider registration](https://open.larksuite.com/document/uMzNwEjLzcDMx4yM3ATM/uUzNwEjL1cDMx4SN3ATM)。For more detailed differences and introductions between **Store Apps** and **Enterprise Self-built Apps**, please refer to [Application Type Introduction - Quickly understand the application types in Lark - Development Documentation - Lark Open Platform](https://open.larksuite.com/document/home/app-types-introduction/overview)。

3. Click **Add Features** on the left, select **Base extensions** , select **Record view**, and finally click **+Add**。

![添加应用能力.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/7dbb258ebd6ef75eaf8ce31f0ea86145_7oLcSbniZm.png?height=1738&lazyload=true&width=3078)

![12.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/2cab2aa27816d497c71ef8c87230e6e4_YrOUphlqiQ.png?height=1770&lazyload=true&width=2760)

4. Record the App ID and BlockTypeID.
On the created page, record the BlockTypeID, switch to **Credentials and Basic Information**, and record the App ID. App ID and BlockTypeID will be used for project initialization.

![13.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/2adc2c5ce6e8c44408c8e365c5ea4966_0OWNGCcBd2.png?height=1944&lazyload=true&width=2698)

![45.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/a2f5fc5ff0dd81b08f9486c6cc363e06_7NSeW7AiEk.png?height=1352&lazyload=true&width=2898)

# Step 2: Build a development environment

You need to install the Lark developer tools locally and use the tools to initialize the automation plugin project.

## Steps

1. Install the CLI.
```
npm install @lark-opdev/cli@latest -g -f
```
> For detailed usage and commands of the CLI, please refer to: [Lark Developer Tools - Command Line](https://open.larksuite.com/document/uYjL24iN/uEzMzUjLxMzM14SMzMTN/ide-with-commands)。
2. login-cli。
    - The first time you use the CLI, you need to log in. Open the terminal and execute the following command to log in：
    ```
    opdev login
    ```
    - Here the development environment chooses `Lark`：

![cli登陆.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/518971a6fc6cbdcef4e3484fc70a06a4_ivUaU74Hjt.png?height=264&lazyload=true&width=1680)

- After selecting the development environment, the browser scan code login page will be opened automatically, please log in according to the instructions.

- After scanning the code and logging in, the command line will prompt that the login is successful：

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/d09ec83ffa1cff6b5afba3ffde0f46d9_IW2r3RyVnd.png?height=100&lazyload=true&width=734)

3. Create a project.
Create a template project with the following command:
    - app-dir needs to be replaced with the directory name of your project。
    - view-dir needs to be replaced with the directory name of your plugin。
    ```
    opdev create ${app-dir}/${view-dir}  -a bitable-extensions -s record-view
    ```
    The creation process will ask `Do you need to create a new application?`
    - If you select `No`, you will be asked to fill in the ID information obtained in step 1: App ID and BlockTypeID. You can also modify the blockTypeID in the block.json file and the appId in the app.json file in the created project, so that the code can be used for your other application plugins。For detailed descriptions of these two files, please refer to the **Principles of Code Uploading and Secondary Development** in the issue collection in this article.

![11.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/ac5794deb3f0eb5680dcfd7db55b9376_ybELitxpvw.png?height=164&lazyload=true&width=1630)

> task-manager is a React Demo Project for task management, conforming to the NPM Module definition.
     >
     > The `blockTypeID` field in the `block.json` file of the generated template is the BlockTypeID filled in the command line during initialization.
     >
     > `appId` in the `app.json` file is the App ID filled in the command line during initialization。
    - Select Yes, if there is no ISV qualification, a **Enterprise Self-built Application** and a **View Plugin** will be automatically created。

![12.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/7da896035d2beb56f4feb263a6b4148c_uxB7ioDn0r.png?height=202&lazyload=true&width=1654)

If you have ISV qualification, you can choose to create store applications `Store Apps`, or enterprise self-built applications `Custom Apps`。

4. Initialize the project.
Install project dependencies with the following command:
```
cd ${app-dir}/${view-dir} 
npm install
```

# Step 3: Debugging

The project created by default uses React + Typescript + Webpack as the development environment; you can also choose the development environment you are used to, such as Vue; but please keep using Webpack for development and install [@lark-opdev/block-bitable-webpack-utils](https://www.npmjs.com/package/@lark-opdev/block-bitable-webpack-utils)。

## Steps

1. Enter debugging
Execute the following command to start WebpackDevServer to enter development and debugging.
```
npm run start
```
It will automatically open a multi-dimensional table document for you, and bring the debug parameter of `debugPort=${current application port}`.
ps. If the page cannot be clicked or operated, you can try to remove the vb field on the url.

2. Add a record view component to the document. On the multidimensional table page that opens, click the Expand button.

![13.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/3069bd330de9a79ddf4d96ded8f40640_RiuGJ6Aa98.png?height=1148&lazyload=true&width=3474)

3. Click the **+** button on the right side of the expanded panel。

![14.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/5eb9c8f2e669eff34ccd76bff8eaa652_L4erzj1mw6.png?height=1684&lazyload=true&width=2410)

4. Select your locally developed component (usually blk_xxx), click **+** **Add Plugin**。

![15.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/9e11c93404c6ca1e92de479773f92cc2_sSacK4QyzY.png?height=964&lazyload=true&width=1750)

5. Debug your plugin in a new tab。

![16.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/b287ea5df263023f9a37aeb7d8703e48_DajCZo6e2z.png?height=834&lazyload=true&width=1718)

## Call the API through the SDK

We provide some API capabilities through the [@lark-opdev/block-bitable-api](https://www.npmjs.com/package/@lark-opdev/block-bitable-api) SDK, which can read and write Bitable data. For the API list, please refer to API list。
```
import { bitable } from "@lark-opdev/block-bitable-api";
const tableMetaList = await bitable.base.getTableMetaList();
```

## Apply for the permissions corresponding to the API

1. API calls are controlled by permissions. Please enter the developer background according to the call permissions required by the specific API, find the **Permissions & Scopes** page, and search for the corresponding permissions.

![5.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/d1cb8441d14d04ec01cb380cc6487892_64kE3EMMi9.png?height=1636&lazyload=true&width=2762)

2. Click the **Permissions & Scopes** button.

3. Republish the app once, the permission you just applied for can be seen in the version details, and the permission will take effect after the application is grayed out.

![17.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/51fc81ab884d75a321308d5c23897281_1A20zEJwz1.png?height=1944&lazyload=true&width=2738)

## Optimize debugging

- If you expect to replace the open multidimensional table document, you can change the `url` property in `block.json`.
```
{
  "manifestVersion": 1,
  "blockTypeID": "blk_xxxxxxxxxxxx",
  "projectName": "task-manager",
  "url": "https://example.feishu.cn/base/xxxxxxxxxx"
}
```

# Step 4: Publish and install

## publish

1. Upload code
You can use the following commands to compile and upload:
```
npm run upload
```
You can also use the following command to upload only:
```
opdev upload ./dist
```
During the upload process, you need to input the version, please use the semantic version such as `0.0.1` (reference: [Semver](https://semver.org/)), and ensure that the version is incremented.
You can also modify the blockTypeID in the block.json file and the appId in the app.json file to make the code available for your other application plugins.
![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/c5de5fee643f17a072f933efc0be180d_4rK1W8eqtx.png?height=132&lazyload=true&width=852)

2. Re-enter the developer background and switch to **Base record view**. **Block Version** Select the version number filled in when you just uploaded, then upload the icon, fill in the name and introduction. Finally click **Save**.

![18.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/310d4b95b90a4c2def4f2f0e82a4f5cb_uPuKn97Dwr.png?height=1950&lazyload=true&width=2986)

3. Publish
     > Here we take the release process of **enterprise self-built application** as an example. If you are using **Store App**, you need to pay attention to the strict review process for merchant release. For detailed process, please refer to[Step1 ISV Registration](https://open.larksuite.com/document/uMzNwEjLzcDMx4yM3ATM/uUzNwEjL1cDMx4SN3ATM)。

- Switch to **Version Management & Release**. Then click **Create a version**, fill in **App version** , **Update Notes** (Note: The version here is the application version, and an application may have multiple plugins).

![21.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/cbeb842c812ec20fc43185b448a2cf84_glpoddb14z.png?height=1998&lazyload=true&width=2934)

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/f89bae7e7cb29d136478f2df545d8a0e_ZdPNX6uSgn.png?height=1978&lazyload=true&width=2996)

- Confirm the permission and visibility range, and click **Save** after confirmation。
    - Click **Submit for release** and wait for the administrator to review。

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/a5df0476556f83b0e869d49e84dcaf34_fJCiCNYvif.png?height=1874&lazyload=true&width=2938)

## Install

Here is an example of an enterprise self-built application. After the application is approved, users can see that your plug-in can be installed in the multi-dimensional table record view:

![14.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/00cd72cfe5b296e13cb74078a4595ac3_b4eMBvC2rD.png?height=1132&lazyload=true&width=3440)

Click the **+Add Extension** button:

![15.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/9e11c93404c6ca1e92de479773f92cc2_0m6Wh9eOuq.png?height=964&lazyload=true&width=1750)

Once added, you will be able to see your application in the record view of the multidimensional table:

![16.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/b287ea5df263023f9a37aeb7d8703e48_yEN3KWRiVQ.png?height=834&lazyload=true&width=1718)

# Problem sorting

## Q: The principle of code upload and secondary development
When executing npm run upload, the development tool @lark-opdev/cli will search for app.json at the same level as the directory where the command is executed, and identify the appId field in it. The meaning of appId is your application in the open platform. If you want to upload the code to other applications, you can modify the appId field in app.json to the appId of the target application.

![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/c3df0a9a152659e81eff8df95630acbe_wOfpkqzOHR.png?lazyload=true&width=2038&height=750)

Next, the blockTypeID will be found in block.json in the directory below the execution of this command. The blockTypeID here is the BlockTypeID of an application capability in the application (the application corresponding to the appId).

It should be noted that the type of application capability needs to correspond to the template type of the code. For example, the blockTypeID in the automation plug-in code can only be filled in with the BlockTypeID of the **Multidimensional Form Automation Operation** type in the open platform, but cannot be filled in as the **Multidimensional Form Record. BlockTypeID of view ** or ** multidimensional tabular data table view **.

![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/0672ed071f25cf4c145b74e9074f53b8_QltEzGh4Kv.png?lazyload=true&width=2590&height=840)

Then @lark-opdev/cli will find the target application that needs to be uploaded based on the appId in app.json in the currently logged in user's application, and then find the corresponding application capability under the application based on the blockTypeID, and finally upload the code to the application capability. .

If you want to upload the code to other application capabilities, you can directly modify these two files and then execute `npm run upload`.

If the upload fails, you can use the `opdev whoami` command to view the current logged in user. Make sure that the current user's open platform has the application corresponding to the appId in app.json, and the application has the application capability corresponding to the blockTypeID in block.json.

# FAQ

### Q: How to complete the user login authorization process (and obtain user information, call OpenAPI)

#### Use the `requestAccess` method
Using the `requestAccess` method requires updating `@lark-opdev/block-open-api` to version 0.2.0 and above
To obtain `user_access_token`, please refer to [Login gadget](https://open.larksuite.com/document/uYjL24iN/uETO5QjLxkTO04SM5kDN).
Here we are in the plugin page:
1. Introduce the `@lark-opdev/block-open-api` package:

`npm install @lark-opdev/block-open-api`;

2. Import and use the `requestAccess` method to get `code`:
```js
import { requestAccess } from "@lark-opdev/block-open-api";
const {code} = await requestAccess({
scopes: ['bitable:app','bitable:app:readonly'],
state: undefined,
});
```
It will raise an authorization window to prompt the user whether to authorize, and a code will be returned after successful authorization.

`requestAccess` parameter description

Field name | Type | Description | Is it required?
---|---|---|---
scopes | String[] | Scope List that requires authorization, see scopes below for details | Yes
state | String | An additional string used to maintain request and callback status. This parameter will be appended when the authorization is completed and the callback is completed. The application can determine the context based on this string. | No
- scopes parameter description<br>Required, the value is a string array of names of open platform permissions (and permissions that have been enabled for this application)<br>![2.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/42ed342d6bec4e0ff3ddba499796eee8_ED3TkLhD4l.png?height=1828&lazyload=true&width=4784)<br>`requestAccess` return value description<br>Field name | Type | Description
code | String | Temporary login credentials, valid for 3 minutes, can only be used once
state | String | An additional string used to maintain request and callback status. This parameter will be appended when the authorization is completed and the callback is completed. The application can determine the context based on this string.
3. After obtaining the `temporary authorization code` (the `code` is valid for three minutes and can only be used once), call [Get user_access_token](https://open.larksuite.com/document/uYjL24iN/ukjM04SOyQjL5IDN)  in exchange for `user_access_token`.<br>4. Next, you can use the `user_access_token` you just exchanged to call the [Get User Information](https://open.larksuite.com/document/common-capabilities/sso/api/get-user-info) interface.<br>#### Use the `login` method<br>For [app_access_token](https://open.larksuite.com/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/app_access_token) and [tenant_access_token](https://open.larksuite.com/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/tenant_access_token) is processed through the server, and its acquisition method is no different from the normal process.<br>This method is only valid for view plugins.<br>To use the login method, `@lark-opdev/block-open-api` needs to be updated to `0.1.5` and above;<br>This interface will change within 2023 Q3, please pay attention to the changes;<br>A: To obtain `user_access_token`, you can generally refer to [login gadget](https://open.larksuite.com/document/uYjL24iN/uETO5QjLxkTO04SM5kDN).<br>We are in the plugin page:<br>1. Import `@lark-opdev/block-open-api` package:<br>` npm install @lark-opdev/block-open-api`<br>1. Import and use `login` method to get `code`:<br>```js<br>import { login } from "@lark-opdev/block-open-api";<br>const loginRes = await login();<br>const code = loginRes.code;<br>```<br>3. After obtaining the `temporary authorization code` (the `code` is valid for three minutes), call the [code2session interface](https://open.larksuite.com/document/uYjL24iN/ukjM04SOyQjL5IDN) through the server to exchange for `user_access_token`.<br>3. The next, you can call the [Get User Information](https://open.larksuite.com/document/common-capabilities/sso/api/get-user-info) interface with the newly obtained `user_access_token`.<br>### Q: How to add front-end router<br>A: It is not recommended to use a path-based router. For the time being, static file services for multidimensional tables do not provide rewrite capabilities.<br>It is recommended to use hash router [React HashRouter](https://reactrouter.com/en/main/router-components/hash-router).<br>### Q: The type hint of VSCode is not normal after updating dependencies<br>A: Try to restart VSCode, or delete the `node_modules` directory and reinstall dependencies.<br>### Q: How to modify the document that is automatically opened when debugging is started<br>A: Modify the `url` attribute in `block.json` in the plugin directory.<br>### Q: How to modify the name of the small application when debugging locally<br>A: Note that the name of the online mini-app needs to be set in the background of the open platform developer.<br>Modify the projectName property in `block.json` under the plugin directory.<br>### Q: What is the page hosting domain name of the view plugin?<br>A: The plugin will use different domain names:<br>Brand | Plugin domain name | Plugin hosting domain name | Lark | https://*.larkpkg.com | https://*.lark.com
