-- 创建额外的数据库
-- 此脚本在 PostgreSQL 容器首次启动时自动执行
-- 主数据库 (zera) 由 POSTGRES_DB 环境变量创建

-- 创建 Casdoor 数据库
CREATE DATABASE casdoor;

-- 如需更多数据库，在此添加：
-- CREATE DATABASE another_db;
