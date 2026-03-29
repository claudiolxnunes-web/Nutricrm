CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`farmName` varchar(255) NOT NULL,
	`producerName` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`whatsapp` varchar(20),
	`animalType` enum('bovinos','suinos','aves','equinos','outros') NOT NULL,
	`animalQuantity` int DEFAULT 0,
	`address` text,
	`city` varchar(100),
	`state` varchar(2),
	`zipCode` varchar(10),
	`notes` text,
	`status` enum('ativo','inativo','prospect') NOT NULL DEFAULT 'prospect',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`opportunityId` int,
	`type` enum('visita','ligacao','email','nota','reuniao') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`date` datetime NOT NULL,
	`duration` int,
	`result` text,
	`nextAction` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`stage` enum('prospeccao','visita_tecnica','orcamento_enviado','negociacao','venda_concluida','perdida') NOT NULL DEFAULT 'prospeccao',
	`value` decimal(12,2),
	`probability` int DEFAULT 0,
	`expectedCloseDate` datetime,
	`closedDate` datetime,
	`assignedTo` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`stock` int DEFAULT 0,
	`unit` varchar(50) DEFAULT 'kg',
	`active` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quoteItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`totalPrice` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quoteItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int,
	`clientId` int NOT NULL,
	`quoteNumber` varchar(50) NOT NULL,
	`status` enum('rascunho','enviado','aceito','rejeitado','expirado') NOT NULL DEFAULT 'rascunho',
	`totalValue` decimal(12,2) DEFAULT '0',
	`discount` decimal(10,2) DEFAULT '0',
	`finalValue` decimal(12,2) DEFAULT '0',
	`validityDays` int DEFAULT 30,
	`notes` text,
	`createdBy` int NOT NULL,
	`sentAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `quotes_quoteNumber_unique` UNIQUE(`quoteNumber`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunityId` int,
	`clientId` int NOT NULL,
	`quoteId` int,
	`saleNumber` varchar(50) NOT NULL,
	`totalValue` decimal(12,2) NOT NULL,
	`paymentStatus` enum('pendente','parcial','pago') NOT NULL DEFAULT 'pendente',
	`saleDate` datetime NOT NULL,
	`deliveryDate` datetime,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_saleNumber_unique` UNIQUE(`saleNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','vendedor') NOT NULL DEFAULT 'vendedor';--> statement-breakpoint
CREATE INDEX `createdByIdx` ON `clients` (`createdBy`);--> statement-breakpoint
CREATE INDEX `statusIdx` ON `clients` (`status`);--> statement-breakpoint
CREATE INDEX `animalTypeIdx` ON `clients` (`animalType`);--> statement-breakpoint
CREATE INDEX `clientIdIdx` ON `interactions` (`clientId`);--> statement-breakpoint
CREATE INDEX `opportunityIdIdx` ON `interactions` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `typeIdx` ON `interactions` (`type`);--> statement-breakpoint
CREATE INDEX `dateIdx` ON `interactions` (`date`);--> statement-breakpoint
CREATE INDEX `clientIdIdx` ON `opportunities` (`clientId`);--> statement-breakpoint
CREATE INDEX `stageIdx` ON `opportunities` (`stage`);--> statement-breakpoint
CREATE INDEX `assignedToIdx` ON `opportunities` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `categoryIdx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `activeIdx` ON `products` (`active`);--> statement-breakpoint
CREATE INDEX `quoteIdIdx` ON `quoteItems` (`quoteId`);--> statement-breakpoint
CREATE INDEX `productIdIdx` ON `quoteItems` (`productId`);--> statement-breakpoint
CREATE INDEX `clientIdIdx` ON `quotes` (`clientId`);--> statement-breakpoint
CREATE INDEX `opportunityIdIdx` ON `quotes` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `statusIdx` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `clientIdIdx` ON `sales` (`clientId`);--> statement-breakpoint
CREATE INDEX `opportunityIdIdx` ON `sales` (`opportunityId`);--> statement-breakpoint
CREATE INDEX `paymentStatusIdx` ON `sales` (`paymentStatus`);