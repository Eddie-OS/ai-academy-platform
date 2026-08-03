import { api, query } from './client';
import type { PageResult } from './types';

/**
 * 人员台账（需求 14.1 导入的人员表）。
 *
 * <p>课程负责人、需求提出人这类「选一个人」的字段都从这里取。<b>它不是账号体系</b>——
 * 人员表里没有账号、没有角色，选中的人不会因此获得任何权限（纪律 PMI-4：owner 不参与判权）。
 */

export interface Employee {
  id: number;
  employeeNo: string;
  employeeName: string;
  deptName: string;
  personType: string;
  personState: string;
}

export const employeeApi = {
  page: (params: { keyword?: string | null; dept?: string | null; personState?: string | null },
         pageNum = 1, pageSize = 200) =>
    api.get<PageResult<Employee>>(`/api/employees${query({ ...params, pageNum, pageSize })}`),

  detail: (employeeNo: string) => api.get<Employee>(`/api/employees/${employeeNo}`),

  depts: () => api.get<string[]>('/api/employees/depts'),
};
