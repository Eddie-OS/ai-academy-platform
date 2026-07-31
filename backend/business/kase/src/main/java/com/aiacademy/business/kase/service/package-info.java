/**
 * 案例 模块的业务规则与事务边界。
 *
 * <p>本项目的事务边界在这一层。状态变更一律调用状态机引擎，不写 if-else 状态判断。
 *
 * <p><b>禁止：</b>不写任何 SQL（AR-5）、不比较账号类型、不读 owner_id 判权（AR-7、PMI-4）；不增加需求之外的业务前置校验（C2：状态变更只校验状态机合法性）。
 */
package com.aiacademy.business.kase.service;
