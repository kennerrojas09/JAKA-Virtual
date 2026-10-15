-- Crear la base de datos de JAKA Virtual
IF DB_ID('JAKAVirtualDB') IS NULL
BEGIN
    CREATE DATABASE JAKAVirtualDB;
END;
GO

-- Comprobar que fue creada
SELECT name
FROM sys.databases
WHERE name = 'JAKAVirtualDB';
GO

USE JAKAVirtualDB;
GO

-- 1. Tabla de roles del sistema
CREATE TABLE Roles (
    IdRol INT IDENTITY(1,1) PRIMARY KEY,
    NombreRol NVARCHAR(30) NOT NULL UNIQUE
);
GO

-- 2. Tabla de usuarios
CREATE TABLE Usuarios (
    IdUsuario INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    Apellido NVARCHAR(100) NOT NULL,
    Correo NVARCHAR(254) NOT NULL UNIQUE,
    ContrasenaHash NVARCHAR(255) NOT NULL,
    IdRol INT NOT NULL,
    Estado BIT NOT NULL DEFAULT 1,
    FechaCreacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Usuarios_Roles
        FOREIGN KEY (IdRol) REFERENCES Roles(IdRol)
);
GO

-- 3. Registrar los tres roles
INSERT INTO Roles (NombreRol)
VALUES
    (N'Administrador'),
    (N'Docente'),
    (N'Estudiante');
GO

-- 4. Verificar los roles registrados
SELECT * FROM Roles;
GO


    USE JAKAVirtualDB;
GO

SELECT
    u.IdUsuario,
    u.Nombre,
    u.Apellido,
    u.Correo,
    r.NombreRol,
    u.Estado
FROM dbo.Usuarios AS u
INNER JOIN dbo.Roles AS r
    ON u.IdRol = r.IdRol
ORDER BY u.IdUsuario;

USE JAKAVirtualDB;
GO

SELECT
    u.IdUsuario,
    u.Nombre,
    u.Apellido,
    u.Correo,
    r.NombreRol,
    u.Estado
FROM dbo.Usuarios AS u
INNER JOIN dbo.Roles AS r
    ON u.IdRol = r.IdRol
WHERE r.NombreRol = 'Administrador';

USE JAKAVirtualDB;
GO

SELECT Correo
FROM dbo.Usuarios u
INNER JOIN dbo.Roles r ON u.IdRol = r.IdRol
WHERE r.NombreRol = N'Administrador';

SELECT
    u.IdUsuario,
    u.Nombre,
    u.Apellido,
    u.Correo,
    r.NombreRol,
    u.Estado
FROM dbo.Usuarios AS u
INNER JOIN dbo.Roles AS r
    ON u.IdRol = r.IdRol
WHERE r.NombreRol = N'Administrador';

SELECT
    u.IdUsuario,
    u.Nombre,
    u.Apellido,
    u.Correo,
    r.NombreRol,
    u.Estado
FROM dbo.Usuarios AS u
INNER JOIN dbo.Roles AS r
    ON u.IdRol = r.IdRol
WHERE r.NombreRol = N'Administrador'
ORDER BY u.IdUsuario;
USE JAKAVirtualDB;
GO

SELECT
    u.IdUsuario,
    u.Nombre,
    u.Apellido,
    u.Correo,
    r.NombreRol,
    u.Estado
FROM dbo.Usuarios u
INNER JOIN dbo.Roles r ON u.IdRol = r.IdRol
ORDER BY u.IdUsuario; 


SELECT DB_NAME() AS BaseDeDatosActual;

SELECT name AS Tabla
FROM sys.tables
WHERE name IN ('Roles', 'Usuarios', 'Apartados');

USE JAKAVirtualDB;
GO

SELECT 
    TABLE_SCHEMA,
    TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('Roles', 'Usuarios', 'Apartados');

SELECT * FROM dbo.Roles;
SELECT TOP 5 * FROM dbo.Usuarios;

USE JAKAVirtualDB;
GO

SELECT name
FROM sys.tables
ORDER BY name;

USE JAKAVirtualDB;
GO

EXEC sp_help 'dbo.Usuarios';
GO

EXEC sp_help 'dbo.Roles';
GO