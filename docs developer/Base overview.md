# Base overview

Lark Base is a powerful data management platform, which can help you build applications and re-organize the online data collaboration. With Lark Base, you can transform complex data into actionable insights, build up customized applications and keep everything on tracked. Lark Base APIs enable you to easily integrate Lark Base with other systems and platforms, ensuring real-time updates for all your data.
## Typical cases

The open platform provides customer practice cases that integrate Base capabilities:

- [Sesame Open, building an access control management system in Lark in five days](https://open.larksuite.com/solutions/detail/wiseasy)
- [Lark Integration Platform, upgrading project management and sales experience in the enterprise service industry](https://open.larksuite.com/solutions/detail/cloudwise)
## Development tutorials

Explore the following Base-related tutorials to learn how to use the Base API to facilitate efficient enterprise collaboration.

- [Quick access to Base](https://open.larksuite.com/document/home/quick-access-to-base/preparation)
- [Agile project management with Base](https://open.larksuite.com/document/home/agile-project-cycle-management-based-on-bitable/introduction)
## Authentication instructions
Before using the `tenant_access_token` to access Base resources, ensure your application is either an owner or collaborator of the Base; otherwise, the call will fail. You can add the app as a collaborator by adding it to the document application, or create a Base with the app's identity and use the `tenant_access_token` to call the API.

## Usage limitations

The Base API has the following restrictions:
- For batch operations, a maximum of 1,000 records can be processed at a time, with the response status being entirely successful or failed.
- To ensure stability, it is recommended to perform only **one** API write operation at a time on a single Base.
Resource quantity limits within a single Base are listed below:

| **Resource**             | **Maximum Limit**             |
|--------------------------|-------------------------------|
| Records                  | Varies by tenant; no extra restrictions from the platform. Refer to the Base UI for details. ![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/c05d45fab4f5c8862624821d9370d2dc_1iQ0TinUhV.png?height=582&lazyload=true&width=1128) |
| Fields                   | 300, with up to 100 formula fields |
| Views                    | 200                           |
| Tables                   | 100                           |
| Custom Roles             | 30                            |
| Advanced Permission Collaborators | 200                   |

## Resource introduction

Currently, Base provides interfaces for eight resource types: Base App, Tables, Views, Records, Fields, Dashboards, Custom Roles, and Advanced Permission Collaborators. This section introduces the meaning of these resources. 

![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/80c83de730f0d48a6e2347009c6b2633_N8DO0TPC1z.png?height=719&lazyload=true&maxWidth=700&width=1280)

### Base App

A Base can be considered an application (not to be confused with developer-created apps), identified by a unique `app_token`. A Base can exist as a standalone app or be integrated as a block within documents and spreadsheets.

#### Forms of Base

| **Base form** | **Resource definition** | **Meaning** |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base in folder | Base app | Base stored in a folder in the cloud space (cloud drive). The URL starts with **larksuite.com/base**. |
| Base under wiki | Base app and wiki node | Base placed in a wiki. The URL starts with **larksuite.com/wiki**. |
| Base embedded in doc | Base docx block | Base embedded in a "Doc". The URL starts with **larksuite.com/docx**. |
| Base embedded in sheet | Base sheet block | Base embedded in a sheet. The URL starts with **larksuite.com/sheets**. 
#### Obtaining Base `app_token`

The method for obtaining the `app_token` varies depending on the form of the Base.

##### **Base in a Folder**

The `app_token` for this form of Base is highlighted in the URL.

![Base Folder URL](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/6916f8cfac4045ba6585b90e3afdfb0a_sTn7sVvhOB.png?height=766&lazyload=true&maxWidth=700&width=3004)

##### **Base in Knowledge Base**

Call the [Get Node Information](https://open.larksuite.com/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-v2/space/get_node) API to obtain the `app_token`. For example, when the `obj_type` is `bitable`, the `obj_token` value is the `app_token`.
```json
{
    "node":{
        "space_id":"6946843325487912356",
        "node_token":"wikcnKQ1k3p******8Vabcef",
        "obj_token":"AW3Qbtr2cakCnesXzXVbbsrIcVT",
        "obj_type":"bitable"
    }
}
```

##### **Base Embedded in Document**
To obtain the app_token for a Base embedded in a document, call the Get Document Blocks API.

```json
{
  "bitable": {
    "token": "AW3Qbtr2cakCnesXzXVbbsrIcVT_tblkIYhz52o6G5nx"
  }
}
```
##### **Base Embedded in Spreadsheet**
For Bases embedded in spreadsheets, call the Get Spreadsheet Metadata API.

```json
{
  "blockInfo": {
    "blockToken": "AW3Qbtr2cakCnesXzXVbbsrIcVT_tblkIYhz52o6G5nx",
    "blockType": "BITABLE_BLOCK"
  }
}
```

### Table

The data container in a Base. Each Base has at least one data table, but it can have multiple data tables. Each data table has a unique identifier called `table_id`. The `table_id` is unique within a single Base app but not necessarily unique globally.
You can obtain the `table_id` from the Base URL; the highlighted part in the image below shows the unique identifier for the current data table. You can also use the [List Tables](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table/list) API to get the `table_id`.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/18741fe2a0d3cafafaf9949b263bb57d_yD1wkOrSju.png?height=746&lazyload=true&maxWidth=700&width=2976)

### View

Refers to the summary and presentation format of the data. There are various types of views, including Table View, Kanban View, Gallery View, Gantt View, and Form View. Each data table has at least one view and may have multiple views. Each view has a unique identifier called `view_id`, which is unique within a single Base but not necessarily unique globally.
You can obtain the `view_id` from the Base URL; the highlighted part in the image below shows the unique identifier for the current view. You can also use the [List Views](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-view/list) API to get the `view_id`. It is currently not possible to retrieve the `view_id` for embedded Bases.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/140668632c97e0095832219001d17c54_c76RMwZAgW.png?height=748&lazyload=true&maxWidth=700&width=2998)

#### **Form View**

Form View is a type of view in a Base, similar to a questionnaire, which can be used to collect information and data. Each form has a unique identifier called `form_id`, which corresponds to the current view's `view_id`. The method for obtaining `form_id` is the same as for `view_id`.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/b8d9bd2d7e1ca7d0cc955ef7f1f4fe16_zDd5TqOh3Q.png?height=942&lazyload=true&maxWidth=600&width=1327)

### Record

Each row of data in a data table is a record. Every record has a unique identifier called `record_id`, which is unique within a single Base but not necessarily unique globally. The `record_id` can be obtained using the [Search Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/search) API.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/abc84b39be159ccdcafa707ee141144d_3fcTz7mMP5.png?height=503&lazyload=true&maxWidth=700&width=1536)

### Field

Fields in a Base are equivalent to columns. Bases offer a variety of field types. Each field has a unique identifier called `field_id`, which is unique within a single Base but not necessarily unique globally. The `field_id` can be obtained using the [List Fields](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/list) API. For more details on fields, refer to the [Field Editing Guide](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/guide).

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/6fb2359552ed15433289fbd0d9fc53c1_mGnTo91OJa.png?height=656&lazyload=true&maxWidth=700&width=1170)

### Dashboard

Dashboards are similar to data boards and can be used to analyze data in a Base from different dimensions.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/fae3c8a886a0075fdeeefe5b74f274e5_WepjCfS7Hx.png?height=1490&lazyload=true&maxWidth=600&width=2794)

The unique identifier for a dashboard is called `block_id`, which starts with `blk`. You can get the `block_id` from the Base URL; the highlighted part in the image below shows the unique identifier for the current dashboard. You can also use the [List Dashboards](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-dashboard/list) API to get it.

![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/a966d15323ee73c66b1e9a31d34ae6c7_x3ctncH2nO.png?height=575&lazyload=true&maxWidth=600&width=1397)

### Advanced Permissions

Advanced permissions allow users to set which users can view or edit specific rows in a data table or to specify which columns can be edited by a user. The advanced permission interfaces are divided into **Custom Roles** and **Collaborators**. The **owner** of the Base or users with **management permissions** can set advanced permissions and manage collaborators via the interface. For more details, see the [Advanced Permission Overview](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role/advanced-permission-guide).

#### **Custom Role**

A role added in advanced permissions with set permissions is a custom role. Each custom role has a unique identifier called `role_id`. The `role_id` can be obtained using the [List Custom Roles](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role/list) API.

#### **member**

A member of a custom role in the advanced permissions settings is a collaborator. Each collaborator has a unique identifier called `member_id`, which can be obtained using the [List Collaborators](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role-member/list) API.
### Workflows

Automated workflows are rules set by the user for automatic operation in the Base. After setting "trigger conditions" and "execute actions," the Base will automatically execute the next step based on data changes. You can obtain the ID of automated workflows, i.e., `workflow_id`, through the [List automated workflows](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-workflow/list) interface.

### Method list

#### Base
> "Store" represents [Store apps](https://open.larksuite.com/document/home/app-types-introduction/overview); "Custom" represents [Custom apps](https://open.larksuite.com/document/home/app-types-introduction/overview)

**[Method (API)](https://open.larksuite.com/document/ukTMukTMukTM/uITNz4iM1MjLyUzM)** | </md-th ><br>Permission requirements (satisfy any one) | **[Access Credentials](https://open.larksuite.com/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM)** **(choose one)** | </ md-th><br>Store | Custom
---|---|---|---|---
[Get App Info](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app/get)<br>`GET` /open-apis/bitable/v1/apps/:app_token | View, comment, and export Bitable(bitable:app:readonly)<br>View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Update App Info](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app/update)<br>`GET` /open-apis/bitable/v1/apps/:app_token | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**

#### Table

**[Method (API)](https://open.larksuite.com/document/ukTMukTMukTM/uITNz4iM1MjLyUzM)** | </md-th ><br>Permission requirements (satisfy any one) | **[Access Credentials](https://open.larksuite.com/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM)** **(choose one)** | </ md-th><br>Store | Custom
---|---|---|---|---
[List Tables](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table/list)<br>`GET` /open-apis/bitable/v1/apps/:app_token/tables | View, comment, and export Bitable(bitable:app:readonly)<br>View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Create Table](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table/create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Create Tables](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table/batch_create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/batch_create | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete Table](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table/delete)<br>`DELETE` /open-apis/bitable/v1/apps/:app_token/tables/:table_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete Tables](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table/batch_delete)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/batch_delete | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**

#### View

**[Method (API)](https://open.larksuite.com/document/ukTMukTMukTM/uITNz4iM1MjLyUzM)** | </md-th ><br>Permission requirements (satisfy any one) | **[Access Credentials](https://open.larksuite.com/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM)** **(choose one)** | </ md-th><br>Store | Custom
---|---|---|---|---
[List Views](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-view/list)<br>`GET` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/views | View, comment, and export Bitable(bitable:app:readonly)<br>View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Create View](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-view/create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/views | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete View](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-view/delete)<br>`DELETE` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/views/:view_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**

#### Record

**[Method (API)](https://open.larksuite.com/document/ukTMukTMukTM/uITNz4iM1MjLyUzM)** | </md-th ><br>Permission requirements (satisfy any one) | **[Access Credentials](https://open.larksuite.com/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM)** **(choose one)** | </ md-th><br>Store | Custom
---|---|---|---|---
[List records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/list)<br>`GET` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records | View, comment, and export Bitable(bitable:app:readonly)<br>View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Get Record](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/get)<br>`GET` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/:record_id | View, comment, and export Bitable(bitable:app:readonly)<br>View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Create record](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Create Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/batch_create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/batch_create | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Update Record](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/update)<br>`PUT` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/:record_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Update Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/batch_update)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/batch_update | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete Record](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/delete)<br>`DELETE` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/:record_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/batch_delete)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/batch_delete | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**

#### Field

**[Method (API)](https://open.larksuite.com/document/ukTMukTMukTM/uITNz4iM1MjLyUzM)** | </md-th ><br>Permission requirements (satisfy any one) | **[Access Credentials](https://open.larksuite.com/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM)** **(choose one)** | </ md-th><br>Store | Custom
---|---|---|---|---
[List Fields](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/list)<br>`GET` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/fields | View, comment, and export Bitable(bitable:app:readonly)<br>View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Create Field](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/fields | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Update Field](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/update)<br>`PUT` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/fields/:field_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete Field](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/delete)<br>`DELETE` /open-apis/bitable/v1/apps/:app_token/tables/:table_id/fields/:field_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**

#### Role

**[Method (API)](https://open.larksuite.com/document/ukTMukTMukTM/uITNz4iM1MjLyUzM)** | Permission requirements (meet either) | **[Access Credentials](https://open.larksuite.com/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM) (choose one)** | Store | Custom
---|---|---|---|---
[List Roles](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role/list)<br>`GET` /open-apis/bitable/v1/apps/:app_token/roles | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Add Role](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role/create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/roles/:role_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Update Role](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role/update)<br>`PUT` /open-apis/bitable/v1/apps/:app_token/roles/:role_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete Role](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role/delete)<br>`DELETE` /open-apis/bitable/v1/apps/:app_token/roles/:role_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**

#### Member

**[Method (API)](https://open.larksuite.com/document/ukTMukTMukTM/uITNz4iM1MjLyUzM)** | Permission requirements (meet either) | **[Access Credentials](https://open.larksuite.com/document/ukTMukTMukTM/uMTNz4yM1MjLzUzM) (choose one)** | Store | Custom
---|---|---|---|---
[List Members](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role-member/list)<br>`GET` /open-apis/bitable/v1/apps/:app_token/roles/:role_id/members | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Add Member](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role-member/create)<br>`POST` /open-apis/bitable/v1/apps/:app_token/roles/:role_id/members | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**
[Delete Member](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-role-member/delete)<br>`DELETE` /open-apis/bitable/v1/apps/:app_token/roles/:role_id/members/:member_id | View, comment, edit and manage Bitable(bitable:app) | `tenant_access_token`<br>`user_access_token` | **✓** | **✓**


# Base FAQs

## 1. How to obtain the `file_token` for an attachment when adding a new record in a Base table?

When adding a [new record](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/create), the `file_token` for attachment-type fields requires the developer to first upload the attachment to the corresponding Base table.

Therefore, you need to call the [Upload Media](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/upload_all) or [Upload a file in blocks-Pre­uploading](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file/upload_prepare) API to upload the attachment to the Base table to obtain the file_token, and then write the record into the Base table.

Note: The file_token is only valid within the current Base table. If you need to upload the attachment to another Base table, you will need to re-upload the media to obtain a new file_token.

## 2. How to download files from records in a Base table?

You can download attachments from the Base table using the [Download Media](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/download) API.

For Base tables with advanced permissions, when calling the [Download Media](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/download) or [Get Temporary Media Download Link](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/media/batch_get_tmp_download_url) API, you need to add the `extra` parameter as a URL query parameter for authentication. You can obtain the `extra` parameter as follows:

1. Call the [Search Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/search) API. The response example will return the download link for the attachment, as shown below:
```json
{
  "code": 0,
  "data": {
    "has_more": false,
    "items": [
      {
        "fields": {
          "Attachment": [
            {
              "file_token": "RSkabsaphoy6yVxK0mGcggabcef",
              "name": "74d2c703524489dbabcef.png",
              "size": 87123,
              "tmp_url": "https://open.larksuite.com/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=RSkabsaphoy6yVxK0mGcggabcef&extra={\"bitablePerm\":{\"tableId\":\"tblz8ExGaVhuiSD1\",\"rev\":32}}",  // Temporary download link for the media, the URL value must be URL-encoded
              "type": "image/png",
              "url": "https://open.larksuite.com/open-apis/drive/v1/medias/RSkabsaphoy6yVxK0mGcggabcef/download?extra={\"bitablePerm\":{\"tableId\":\"tblz8ExGaVhuiSD1\",\"rev\":32}}"   // Download URL for the media, the URL value must be URL-encoded
            }
          ]
        },
        "record_id": "recbMzD0zT"
      }
    ],
    "total": 1
  },
  "msg": "success"
}
```

Example of constructing the URL:

```JSON
{"bitablePerm":{"tableId":"tblO6OeNZxfabcef","attachments":{"fld32zZi5I":{"rec0BuOHq":["boxbcsQNT0JsmrztOnX530abcef"]}}}}
// After escaping
https://open.larksuite.com/open-apis/drive/v1/medias/boxbcsQNT0JsmrztOnX530abcef/download?extra=%7B%22bitablePerm%22%3A%7B%22tableId%22%3A%22tblO6OeNZxfabcef%22%2C%22attachments%22%3A%7B%22fld32zZi5I%22%3A%7B%22rec0BuOHq%22%3A%5B%22boxbcsQNT0JsmrztOnX530abcef%22%5D%7D%7D%7D%7D
```

## 3. What to do if you encounter error codes like 1254040, 1254041, 1254042, 1254043, or 1254044 (NotFound) when calling Base table APIs?

These error codes indicate that the resource corresponding to the provided ID could not be found. You can try the following methods to resolve the issue:

1. Verify that the ID is correct. You can refer to the [Overview of Base tables](https://open.larksuite.com/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/bitable-overview) to find the correct IDs for different resources.
2. If this error occurs shortly after creating a resource, it may be caused by server replication delays. Try waiting for a few seconds and then retrying the request.

## 4. How to resolve the issue when the query record interface is called successfully but the data returned is empty, even though there is data in the multi-dimensional table?

This is usually due to the advanced permissions enabled on the multi-dimensional table, resulting in insufficient calling identity permissions. You need to grant the calling identity **Manage** permissions for the data table or **Manage** permissions for the multi-dimensional table, and then call again. The specific steps are as follows:

- To grant the user manage permissions, you can add the user in the **Multi-dimensional Table Advanced Permissions Settings** and grant sufficient permissions to the user. 

- To grant the application manage permissions, you need to add manage permissions for the application through the **"..."** -> **"...More"** -> **"Add Document Application"** entry in the upper right corner of the multi-dimensional table page.

![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/22c027f63c540592d3ca8f41d48bb107_CSas7OYJBR.png?height=1994&lazyload=true&maxWidth=550&width=3278)

![image.png](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/9f3353931fafeea16a39f0eb887db175_0tjzC9P3zU.png?height=728&lazyload=true&maxWidth=550&width=890)

**Note**:
    Before adding a document application, you need to ensure that the target application has at least one multi-dimensional table [API permission](https://open.larksuite.com/document/ukTMukTMukTM/uYTM5UjL2ETO14iNxkTN/scope-list) enabled. Otherwise, you will not be able to search for the target application in the document application window.

- You can also add a user or a group containing the application in the **Multi-dimensional Table Advanced Permissions Settings**, and grant custom read-write permissions to this group.

## 5. How to resolve the issue when the query record interface returns empty data for a checkbox?

In a multi-dimensional table, if a field is empty, the query record interface does not return data. Accordingly, if the checkbox field is empty (i.e., the user has not selected or deselected the checkbox), the query record interface also does not return data. In this scenario, since the effect of an empty value is the same as the effect of the checkbox being `false`, developers need to handle this empty value scenario on their own.

## 6. How to filter custom number type auto-number fields?

To filter auto-number fields containing fixed characters, you need to remove the custom fixed characters before filtering; otherwise, empty data will be returned.

## 7. How to filter personnel fields when calling the query record interface?

For personnel fields, you need to pass the user's ID in the value. The type of user ID is consistent with the type specified by the `user_id_type` query parameter in the query record interface, which defaults to the Open ID type. The following is a request example for filtering personnel IDs `ou_00d9ea2d7bcd6b6aa7d71dd88deabcef` and `ou_5fdfc3d312b24d28224769baf52abcef`:

```json
{
  "view_id": "vewfrk8iX4",
  "field_names": [
    "creator"
  ],
  "filter": {
    "conjunction": "and",
    "conditions": [
      {
        "field_name": "creator",
        "operator": "contains",
        "value": [
          "ou_00d9ea2d7bcd6b6aa7d71dd88deabcef",
          "ou_5fdfc3d312b24d28224769baf52abcef"
        ]
      }
    ]
  }
}
```

## 8. Does the query record interface support querying specific rows, such as rows 10 to 20 in the data table?

1. Add an auto-numbering field in the multidimensional table, and select auto-increment numbers as the numbering type.

2. Filter the auto-numbering. For example, to query rows 10 to 20, filter the numbers less than 21 and greater than 9, and then call the [Query Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/search) interface. The request body is as follows:

```json
    {
      "view_id": "vewfrk8iX4",
      "field_names": [],
      "filter": {
        "conjunction": "and",
        "conditions": [
          {
            "field_name": "number",
            "operator": "isGreater",
            "value": [
              "9"
            ]
          },
          {
            "field_name": "number",
            "operator": "isLess",
            "value": [
              "21"
            ]
          }
        ]
      }
    }
    ```

You can also call the [Batch Get Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/batch_get) interface to query using the Record ID of the records to get multiple records' data.

## 9. How to get the total number of records (or total rows) of a specified data table in the multidimensional table?

You can call the [Query Records](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/search) interface and set the `conditions` field to empty or not set it in the request body. Here is a request body example:

```json
{
  "view_id": "vewfrk8iX4",  // Please replace with the actual view_id
  "filter": {
    "conjunction": "and",
    "conditions": []
  }
}
```
If the request is successful, the response body will return the `total` field, which is the total number of records.

# Data structure overview

This document introduces the data structure of records, fields, and views in Base tables. The data tables in Base consist of records and fields, and can have multiple views.

## Records
Records consist of two structures: record and fields.

### Record structure

A record is an object structure type.
| Parameter     | Data type         | Description        |
| --------- | -------   | --------- |
|`record_id`| string |  Record ID |
|`fields`| map |  Record fields |

### Fields structure

The fields attribute is of map type, consisting of key-value pairs of field names and their specific contents. For detailed structure and parameter descriptions of fields, refer to [Base record data structure](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/bitable-record-data-structure-overview).
```json
{
  "Task summary": [
    {
      "text": "The website update task is being handled by Huang Paopao and is in progress",
      "type": "text"
    }
  ]
}
```

Parameter | Data type | Description | Example value
---|---|---|---
key | string | Field name in the Base table. | "Task summary"
value | union | The specific content of a field, which can be a number, string, boolean, list of strings, or list of objects. For more details, refer to the following section. | This example value is a list of objects. For more examples, refer to [Base record data structure](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/bitable-record-data-structure-overview).<br>```json<br>[<br>{<br>"text": "The website update task is in progress",<br>"type": "text"<br>}<br>]<br>```

## Fields

Fields are the "columns" in the Base table and are of object structure type. The basic structure of a field is shown below. For detailed structure and parameter descriptions of fields, refer to the [Field editing guide](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/guide).

```json
{
    "field_id": "fldYWaldeW", // Field ID
    "field_name": "Text",   // Field name
    "type": 1,  // Field type, see below for details
    "description": "Field description", // More information about the field
    "is_primary": true,   // Whether this field is the primary index field
    "property": null,   // Field property, see below for details
    "ui_type": "Text",  // The display type of the field in the interface, such as progress field being a display form of a number
    "is_hidden": false  // Whether the field is hidden
}
```
Parameter descriptions are as follows:

Name | Type | Description
---|---|---
field_id | string | Field ID
field_name | string | Field name
type | int | Field type: differentiated by ui_type for the same type:<br>- 1: Text (default), Barcode (declare <code>"ui_type": "Barcode"</code>), Email (declare <code>"ui_type": "Email"</code>)<br>- 2: Number (default), Progress (declare <code>"ui_type": "Progress"</code>), Currency (declare <code>"ui_type": "Currency"</code>), Rating (declare <code>"ui_type": "Rating"</code>)<br>- 3: Single select<br>- 4: Multi select<br>- 5: Date<br>- 7: Checkbox<br>- 11: User<br>- 13: Phone number<br>- 15: URL<br>- 17: Attachment<br>- 18: Single link<br>- 19: Lookup<br>- 20: Formula<br>- 21: Duplex link<br>- 22: Location<br>- 23: Group<br>- 1001: Created time<br>- 1002: Last modified time<br>- 1003: Created by<br>- 1004: Modified by<br>- 1005: Auto number
description | Field description | More information about the field.
is_primary | true/false | Whether this field is the primary index field.
property | object | Field property, varies by field type. For details, refer to the [Field editing guide](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/guide).
ui_type | string | Field UI type:<br>- "Text": Text<br>- "Email": Email<br>- "Barcode": Barcode<br>- "Number": Number<br>- "Progress": Progress<br>- "Currency": Currency<br>- "Rating": Rating<br>- "SingleSelect": Single select<br>- "MultiSelect": Multi select<br>- "DateTime": Date<br>- "Checkbox": Checkbox<br>- "User": User<br>- "GroupChat": Group<br>- "Phone": Phone number<br>- "Url": URL<br>- "Attachment": Attachment<br>- "SingleLink": Single link<br>- "Formula": Formula<br>- "Lookup": Lookup<br>- "DuplexLink": Duplex link<br>- "Location": Location<br>- "CreatedTime": Created time<br>- "ModifiedTime": Last modified time<br>- "CreatedUser": Created by<br>- "ModifiedUser": Modified by<br>- "AutoNumber": Auto number
is_hidden | true/false | Whether the field is hidden.

## Views

A view is an object structure type.

Parameter | Type | Description
---|---|---
view_id | string | View ID. `view_id` is unique within a Base table but not necessarily globally unique. Retrieval methods:<br>- You can obtain the `view_id` through the Base table URL. The highlighted part in the image below is the unique identifier of the current view.<br>![](//sf16-sg.larksuitecdn.com/obj/open-platform-opendoc-sg/140668632c97e0095832219001d17c54_c76RMwZAgW.png?height=748&lazyload=true&maxWidth=700&width=2998)<br>- You can also obtain the `view_id` through the [list views](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-view/list) API. Currently, it is not possible to obtain the `view_id` of a Base table embedded in a document.
view_name | string | View name
view_type | string | View type, supporting the following types, with grid as the default type.<br>- grid: Grid view<br>- kanban: Kanban view<br>- gallery: Gallery view<br>- gantt: Gantt view<br>- form: Form view

## Custom data structure

### delete_record
| Parameter         | Data type           |  Description         | 
| --------- | --------------- | ----------- | 
|`deleted` | `boolean` | Whether the deletion was successful |
|`record_id` | `string` | ID of a single record |
