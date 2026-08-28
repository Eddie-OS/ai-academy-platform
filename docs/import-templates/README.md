# 导入模板冻结包

六类 Excel 模板由后端按列声明 **现场生成**（含「填写说明」第二 sheet）：

```http
GET /api/imports/templates/{type}
```

`type` 取值：`EMPLOYEE`／`ATTENDANCE`／`LECTURER`／`ATTENDEE`／`STUDENT_FEEDBACK`／`TRIAL_FEEDBACK`（以 `GET /api/imports/types` 为准）。

## 冻结步骤（上线前执行一次）

```powershell
$base = 'http://localhost:8080'
# 先登录拿会话后，对每个 type：
# Invoke-WebRequest "$base/api/imports/templates/ATTENDANCE" -OutFile docs/import-templates/ATTENDANCE.xlsx
```

将六个 `.xlsx` 放入本目录后，本 README 即作为填写说明索引（详细规则在各文件第二 sheet）。

## 与 P-2

卡片不显示「最后更新日期」——模板无独立文件版本号，不造假日期。
