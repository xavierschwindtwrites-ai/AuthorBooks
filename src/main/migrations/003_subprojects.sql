ALTER TABLE projects ADD COLUMN parentId TEXT REFERENCES projects(id);
CREATE INDEX idx_projects_parentId ON projects(parentId);
