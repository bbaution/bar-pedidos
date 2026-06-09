-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: acela.proxy.rlwy.net    Database: railway
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES (1,'admin','$2b$10$Z1DTEEjJfnqOUv7f6u0P7umdsTPycf50WmNpL4OsG//Kt6ygYKjdK','2026-06-07 23:36:58');
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `orden` int DEFAULT '0',
  `activa` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (1,'MENU DEL DÍA',1,1),(2,'Rebozados',4,1),(3,'Minutas',3,1),(4,'Sandwiches',4,1),(5,'Empanadas',5,1),(6,'Bebidas',6,1),(7,'Promociones',2,1);
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `guarniciones`
--

DROP TABLE IF EXISTS `guarniciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `guarniciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `disponible` tinyint(1) DEFAULT '1',
  `precio` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `guarniciones`
--

LOCK TABLES `guarniciones` WRITE;
/*!40000 ALTER TABLE `guarniciones` DISABLE KEYS */;
INSERT INTO `guarniciones` VALUES (1,'Papas fritas',1,0.00),(2,'Puré de papas',1,0.00),(3,'Ensalada',1,0.00),(4,'Arroz',1,0.00);
/*!40000 ALTER TABLE `guarniciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `horarios_entrega`
--

DROP TABLE IF EXISTS `horarios_entrega`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `horarios_entrega` (
  `id` int NOT NULL AUTO_INCREMENT,
  `horario` varchar(10) NOT NULL,
  `activo` tinyint(1) DEFAULT '1',
  `orden` int DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `horarios_entrega`
--

LOCK TABLES `horarios_entrega` WRITE;
/*!40000 ALTER TABLE `horarios_entrega` DISABLE KEYS */;
INSERT INTO `horarios_entrega` VALUES (1,'12:00',1,1),(2,'12:30',1,2),(3,'13:00',1,3),(4,'13:30',1,4),(5,'14:00',1,5);
/*!40000 ALTER TABLE `horarios_entrega` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plato_guarniciones`
--

DROP TABLE IF EXISTS `plato_guarniciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plato_guarniciones` (
  `plato_id` int NOT NULL,
  `guarnicion_id` int NOT NULL,
  PRIMARY KEY (`plato_id`,`guarnicion_id`),
  KEY `guarnicion_id` (`guarnicion_id`),
  CONSTRAINT `plato_guarniciones_ibfk_1` FOREIGN KEY (`plato_id`) REFERENCES `platos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `plato_guarniciones_ibfk_2` FOREIGN KEY (`guarnicion_id`) REFERENCES `guarniciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plato_guarniciones`
--

LOCK TABLES `plato_guarniciones` WRITE;
/*!40000 ALTER TABLE `plato_guarniciones` DISABLE KEYS */;
INSERT INTO `plato_guarniciones` VALUES (3,1),(4,1),(5,1),(6,1),(7,1),(8,1),(18,1),(20,1),(21,1),(22,1),(23,1),(24,1),(3,2),(4,2),(5,2),(6,2),(7,2),(8,2),(18,2),(20,2),(21,2),(22,2),(23,2),(24,2),(3,3),(4,3),(5,3),(6,3),(7,3),(8,3),(18,3),(20,3),(21,3),(22,3),(23,3),(24,3),(3,4),(4,4),(5,4),(6,4),(7,4),(8,4),(18,4),(20,4),(21,4),(22,4),(23,4),(24,4);
/*!40000 ALTER TABLE `plato_guarniciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platos`
--

DROP TABLE IF EXISTS `platos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `categoria_id` int DEFAULT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text,
  `precio` decimal(10,2) NOT NULL,
  `foto_url` text,
  `disponible` tinyint(1) DEFAULT '1',
  `permite_guarnicion` tinyint(1) DEFAULT '0',
  `orden` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `platos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platos`
--

LOCK TABLES `platos` WRITE;
/*!40000 ALTER TABLE `platos` DISABLE KEYS */;
INSERT INTO `platos` VALUES (3,2,'Medallón de pollo con guarnición','',7000.00,'',1,1,0),(4,2,'Medallón de merluza con guarnición','',6800.00,'',1,1,0),(5,2,'Medallón de merluza con espinaca y queso con guarnición','',7000.00,'',1,1,0),(6,2,'Bocaditos de calabaza y muzzarella con guarnición','',6800.00,'',1,1,0),(7,2,'Bocaditos de espinaca con guarnición','',6800.00,'',1,1,0),(8,2,'Milanesa de soja con guarnición','',6800.00,'',1,1,0),(9,4,'Sandwich de milanesa','Sandwich de milanesa de nalga con verduras y aderezos. Incluye papas fritas',8800.00,'',1,0,0),(10,4,'Sandwich de milanesa especial','Sandwich de milanesa de nalga con verduras, aderezos, jamon y queso. Incluye papas fritas',9600.00,'',1,0,0),(11,4,'Sandwich de suprema','Sandwich de milanesa de pollo con verduras y aderezos. Incluye papas fritas',8000.00,'',1,0,0),(12,4,'Sandwich de suprema especial con guarnición','Sandwich de milanesa de pollo con verduras, aderezos, jamon y queso. Incluye papas fritas',9000.00,'',1,0,0),(13,5,'Empanada de carne','',1500.00,'',1,0,0),(14,5,'Empanada de pollo','',1500.00,'',1,0,0),(15,5,'Empanada de jamon y queso','',1500.00,'',1,0,0),(16,5,'Empanada de mondongo','',1500.00,'',1,0,0),(17,5,'Sfijas','',1500.00,'',1,0,0),(18,7,'Milanesa napolitana para 2 con guarnición','',18500.00,'',1,1,0),(19,7,'2 sandwich de milanesa con papas fritas','',17000.00,'',1,0,0),(20,3,'Bife de pollo con guarnición','Bife de pollo a la plancha con guarnición',8000.00,'',1,1,0),(21,3,'Suprema con guarnición','Milanesa de pollo al horno',8000.00,'',1,1,0),(22,3,'Suprema napolitana con guarnición','Milanesa de pollo con salsa y queso',9000.00,'',1,1,0),(23,3,'Milanesa con guarnición','Milanesa de carne de nalga con guarnición',8500.00,'',1,1,0),(24,3,'Milanesa napolitana con guarnición','Milanesa de carne de nalga con salsa y queso con guarnición',9500.00,'',1,1,0),(25,6,'Pepsi 500ml','',1500.00,'',1,0,0),(26,6,'Coca cola 600ml','',1800.00,'',1,0,0),(27,6,'Lata pepsi 375ml','',1300.00,'',1,0,0);
/*!40000 ALTER TABLE `platos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-09 12:21:03
