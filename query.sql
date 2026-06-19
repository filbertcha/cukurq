CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    nomor_hp VARCHAR(20) UNIQUE,
    password VARCHAR(100),
    role VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    duration_minutes INTEGER,
    price INTEGER,
    is_active VARCHAR(5)
);

CREATE TABLE queues (
    id SERIAL PRIMARY KEY,
    queue_number INTEGER,
    user_id INTEGER,
    service_id INTEGER,
    queue_date TIMESTAMP,
    status VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_queues_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT fk_queues_service
        FOREIGN KEY (service_id)
        REFERENCES services(id)
);

INSERT INTO users (name, nomor_hp, password, role)
VALUES ('Filbert', '081234567890', '12345', 'super admin'), ('Andi', '081111111111', '12345', 'admin'),
('Budi', '082222222222', '12345', 'admin'), ('Chris', '083333333333', '12345', 'admin');