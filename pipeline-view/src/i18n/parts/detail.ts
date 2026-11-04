import type { DictPart } from '../index';

/** Strings for the record list, record detail, node panel, graph and field editors. */
const detail: DictPart = {
  vi: {
    'detail.untitled': '(Chưa có tiêu đề)',
    'detail.finished': 'Đã hoàn thành',
    'detail.unknownStage':
      'Giai đoạn “{name}” không còn tồn tại trong quy trình (lựa chọn đã bị xóa hoặc đổi tên). Hãy bắt đầu lại từ một bước bên dưới.',

    'detail.state.done': 'Đã xong',
    'detail.state.active': 'Bước hiện tại',
    'detail.state.pending': 'Chưa tới',
    'detail.state.skipped': 'Đã bỏ qua',
    'detail.state.unknown': 'Không rõ',

    'detail.graph.title': 'Quy trình',
    'detail.graph.empty': 'Trường giai đoạn chưa có lựa chọn nào. Hãy thêm bước trong Cài đặt.',
    'detail.graph.countAria': '{count} bản ghi',
    'detail.legend.done': 'Đã xong',
    'detail.legend.current': 'Hiện tại',
    'detail.legend.pending': 'Chưa tới',
    'detail.legend.skipped': 'Đã bỏ qua',
    'detail.legend.unknown': 'Không rõ',
    'detail.graph.unknownState': 'Không rõ đã qua hay chưa',
    'detail.graph.skippedState': 'Đã bỏ qua – bản ghi không đi qua bước này',
    'detail.graph.unknownHint.setup':
      'Chưa biết bản ghi đã đi nhánh nào. Hãy chọn trường “Các bước đã qua” (hoặc trường lịch sử) trong Cài đặt → Trường để theo dõi chính xác các nhánh.',
    'detail.graph.unknownHint.setupPath':
      'Chưa biết bản ghi đã đi nhánh nào. Hãy chọn trường “Các bước đã qua” trong Cài đặt → Trường, rồi tích các bước đã đi để hiện đúng nhánh.',
    'detail.graph.unknownHint.backfill':
      'Chưa rõ bản ghi này đã đi nhánh nào. Tích các bước nó đã đi qua trong trường “{field}” để hiện đúng nhánh.',
    'detail.graph.unknownHint.tick': 'Tích các bước đã qua',

    'detail.header.openRecord': 'Mở bản ghi trong Lark',
    'detail.header.enteredAt': 'Ở bước hiện tại từ {date}',
    'detail.status.none': 'Chưa có trạng thái',
    'detail.status.clear': 'Xóa trạng thái',
    'detail.status.change': 'Đổi {field}',

    'detail.roles.title': 'Vai trò',
    'detail.roles.empty': 'Chưa gán ai',
    'detail.roles.assign': 'Gán người',
    'detail.checklist.title': 'Danh sách kiểm tra',

    'detail.list.title': 'Bản ghi',
    'detail.list.empty': 'Không có bản ghi nào',
    'detail.list.notStarted': 'Chưa bắt đầu',
    'detail.list.unknownStage': 'Giai đoạn không còn tồn tại: {name}',
    'detail.list.showMore': 'Xem thêm ({count})',

    'detail.node.fieldsTitle': 'Thông tin cần nhập',
    'detail.node.openForm': 'Điền bằng biểu mẫu Lark',
    'detail.node.viewInLark': 'Xem trong Lark',
    'detail.node.noFields': 'Chưa cấu hình trường nào cho bước này',
    'detail.node.noFieldsHint': 'Chọn các trường cần nhập trong Cài đặt → Quy trình.',
    'detail.node.requiredProgress': 'Đã điền {filled}/{total} trường bắt buộc',
    'detail.node.assignOwner': 'Gán người phụ trách',
    'detail.node.noOwner': 'Chưa có người phụ trách',
    'detail.node.notice.notStarted': 'Bản ghi chưa bắt đầu quy trình.',
    'detail.node.notice.pending': 'Chưa tới bước này.',
    'detail.node.notice.done': 'Bước này đã hoàn thành.',
    'detail.node.notice.skipped': 'Bước này đã bị bỏ qua.',
    'detail.node.notice.unknown': 'Không rõ bản ghi đã đi qua bước này hay chưa.',
    'detail.node.notice.active': 'Đây là bước hiện tại.',
    'detail.node.notice.editAhead': 'Bạn vẫn có thể nhập trước thông tin.',

    'detail.validation.required': 'Bắt buộc nhập',
    'detail.validation.unchecked': 'Cần được đánh dấu',
    'detail.validation.requiredTitle': 'Bắt buộc',

    'detail.action.startAt': 'Bắt đầu tại {name}',
    'detail.action.startAtMenu': 'Bắt đầu tại…',
    'detail.action.advanceTo': 'Hoàn thành & chuyển tới {name}',
    'detail.action.advanceMenu': 'Hoàn thành & chuyển tới…',
    'detail.action.complete': 'Hoàn thành quy trình',
    'detail.action.finished': 'Quy trình đã hoàn thành',
    'detail.action.noDoneStatus':
      'Đây là bước cuối. Để đánh dấu hoàn thành, hãy chọn trường trạng thái có một trạng thái thuộc nhóm “Hoàn thành” trong Cài đặt.',
    'detail.action.rollbackMenu': 'Trả về…',
    'detail.action.statusNotDone':
      'Hãy chuyển trạng thái sang một trạng thái “Hoàn thành” trước khi sang bước tiếp theo.',
    'detail.action.failed': 'Không thực hiện được thao tác',

    'detail.toast.moved': 'Đã chuyển sang {name}',
    'detail.toast.rolledBack': 'Đã trả về {name}',
    'detail.toast.started': 'Đã bắt đầu tại {name}',
    'detail.toast.completed': 'Đã hoàn thành quy trình',

    'detail.field.checked': 'Đã chọn',
    'detail.field.unchecked': 'Chưa chọn',
    'detail.field.textPlaceholder': 'Nhập nội dung…',
    'detail.field.numberPlaceholder': 'Nhập số',
    'detail.field.selectPlaceholder': 'Chọn…',
    'detail.field.noOptions': 'Không có lựa chọn',
    'detail.field.datePlaceholder': 'Chọn ngày',
    'detail.field.phonePlaceholder': 'Nhập số điện thoại',
    'detail.field.emailPlaceholder': 'Nhập địa chỉ email',
    'detail.field.computed': 'Tự động tính',
    'detail.field.editInLark': 'Sửa trong Lark',
    'detail.field.saveFailed': 'Không lưu được giá trị',
  },
  en: {
    'detail.untitled': '(Untitled)',
    'detail.finished': 'Finished',
    'detail.unknownStage':
      'Stage “{name}” no longer exists in the pipeline (the option was deleted or renamed). Start again from one of the steps below.',

    'detail.state.done': 'Done',
    'detail.state.active': 'Current step',
    'detail.state.pending': 'Not reached',
    'detail.state.skipped': 'Skipped',
    'detail.state.unknown': 'Unknown',

    'detail.graph.title': 'Pipeline',
    'detail.graph.empty': 'The stage field has no options yet. Add steps in Settings.',
    'detail.graph.countAria': '{count} records',
    'detail.legend.done': 'Done',
    'detail.legend.current': 'Current',
    'detail.legend.pending': 'Not reached',
    'detail.legend.skipped': 'Skipped',
    'detail.legend.unknown': 'Unknown',
    'detail.graph.unknownState': 'Not known whether this step was passed',
    'detail.graph.skippedState': 'Skipped – the record did not go through this step',
    'detail.graph.unknownHint.setup':
      'Which branch this record took is unknown. Choose a “Steps passed” field (or a history field) in Settings → Fields to track branches precisely.',
    'detail.graph.unknownHint.setupPath':
      'Which branch this record took is unknown. Choose a “Steps passed” field in Settings → Fields, then tick the steps it went through.',
    'detail.graph.unknownHint.backfill':
      'Which branch this record took is not recorded. Tick the steps it went through in “{field}” to show it.',
    'detail.graph.unknownHint.tick': 'Tick the steps passed',

    'detail.header.openRecord': 'Open record in Lark',
    'detail.header.enteredAt': 'In the current step since {date}',
    'detail.status.none': 'No status',
    'detail.status.clear': 'Clear status',
    'detail.status.change': 'Change {field}',

    'detail.roles.title': 'Roles',
    'detail.roles.empty': 'Nobody assigned',
    'detail.roles.assign': 'Assign people',
    'detail.checklist.title': 'Checklist',

    'detail.list.title': 'Records',
    'detail.list.empty': 'No records',
    'detail.list.notStarted': 'Not started',
    'detail.list.unknownStage': 'Stage no longer exists: {name}',
    'detail.list.showMore': 'Show more ({count})',

    'detail.node.fieldsTitle': 'Information to fill in',
    'detail.node.openForm': 'Fill in Lark form',
    'detail.node.viewInLark': 'View in Lark',
    'detail.node.noFields': 'No fields configured for this step',
    'detail.node.noFieldsHint': 'Choose the fields to fill in under Settings → Pipeline.',
    'detail.node.requiredProgress': '{filled}/{total} required fields filled',
    'detail.node.assignOwner': 'Assign owner',
    'detail.node.noOwner': 'No owner',
    'detail.node.notice.notStarted': 'This record has not entered the pipeline yet.',
    'detail.node.notice.pending': 'Not reached yet.',
    'detail.node.notice.done': 'This step is completed.',
    'detail.node.notice.skipped': 'This step was skipped.',
    'detail.node.notice.unknown': 'It is not known whether the record went through this step.',
    'detail.node.notice.active': 'This is the current step.',
    'detail.node.notice.editAhead': 'You can still fill in its information ahead of time.',

    'detail.validation.required': 'Required',
    'detail.validation.unchecked': 'Must be checked',
    'detail.validation.requiredTitle': 'Required',

    'detail.action.startAt': 'Start at {name}',
    'detail.action.startAtMenu': 'Start at…',
    'detail.action.advanceTo': 'Complete & go to {name}',
    'detail.action.advanceMenu': 'Complete & go to…',
    'detail.action.complete': 'Complete pipeline',
    'detail.action.finished': 'Pipeline completed',
    'detail.action.noDoneStatus':
      'This is the last step. To mark records finished, pick a status field with a status in the “Done” category in Settings.',
    'detail.action.rollbackMenu': 'Send back to…',
    'detail.action.statusNotDone': 'Set the status to a “Done” status before moving to the next step.',
    'detail.action.failed': 'The action could not be completed',

    'detail.toast.moved': 'Moved to {name}',
    'detail.toast.rolledBack': 'Sent back to {name}',
    'detail.toast.started': 'Started at {name}',
    'detail.toast.completed': 'Pipeline completed',

    'detail.field.checked': 'Checked',
    'detail.field.unchecked': 'Not checked',
    'detail.field.textPlaceholder': 'Enter text…',
    'detail.field.numberPlaceholder': 'Enter a number',
    'detail.field.selectPlaceholder': 'Select…',
    'detail.field.noOptions': 'No options',
    'detail.field.datePlaceholder': 'Pick a date',
    'detail.field.phonePlaceholder': 'Enter a phone number',
    'detail.field.emailPlaceholder': 'Enter an email address',
    'detail.field.computed': 'Computed',
    'detail.field.editInLark': 'Edit in Lark',
    'detail.field.saveFailed': 'Could not save the value',
  },
};

export default detail;
