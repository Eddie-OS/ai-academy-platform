/**
 * 状态机引擎 模块的HTTP 入口层。
 *
 * <p>接口一律 /api 前缀、资源名复数英文小写连字符（API-1）；统一响应包装 R<T>（API-3）；状态转换只走 POST /api/{objectType}/{id}/transitions 一个入口，不为每个动作单独开接口（7.4）。
 *
 * <p><b>禁止：</b>不写任何判权逻辑（AR-7）、不写任何 SQL（AR-5）、不做跨业务模块编排（AR-4）。
 */
package com.aiacademy.platform.statemachine.controller;
