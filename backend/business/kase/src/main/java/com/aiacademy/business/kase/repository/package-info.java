/**
 * 案例 模块的数据访问层。
 *
 * <p>单表 CRUD 用 MyBatis-Plus 的 BaseMapper；复杂查询写进 resources/mapper/*.xml。刻意使用 PostgreSQL 专有语法（FILTER、DISTINCT ON、JSONB、部分索引）。
 *
 * <p><b>禁止：</b>这是原生 SQL 唯一允许出现的位置（AR-5）。一切查询必须带 deleted = false（SEC2）。
 */
package com.aiacademy.business.kase.repository;
