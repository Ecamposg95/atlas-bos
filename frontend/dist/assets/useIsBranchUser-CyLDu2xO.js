import{b as s}from"./index-Cnqf-IFu.js";const n=new Set(["CAJERO","GERENTE"]);function u(){const r=s(e=>e.user);return r?n.has(r.role)&&r.branch_id!=null:!1}export{u};
