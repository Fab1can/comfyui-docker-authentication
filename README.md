# ComfyUI Docker Setup with Nginx Authentication

This project provides a Docker Compose setup for running [ComfyUI](https://github.com/comfyanonymous/ComfyUI) with Nginx as a reverse proxy, adding a layer of Basic Authentication for security.

## Features

- **ComfyUI**: Runs the latest ComfyUI (using `zeroclue/comfyui` image) with NVIDIA GPU support.
- **Nginx Reverse Proxy**: Handles HTTP requests and WebSocket connections.
- **Basic Authentication**: Protects your ComfyUI instance with a username and password.
- **Persistent Models**: Maps the local `models/` directory to the container, so your models are preserved.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) (required for GPU support)

## Directory Structure

The `models/` directory is pre-populated with the standard ComfyUI folder structure. Place your model checkpoints, LoRAs, embeddings, etc., in their respective subfolders within `models/`.

## Setup & Installation

1. **Clone the Repository**

    ```bash
    git clone https://github.com/yourusername/your-repo.git
    cd your-repo
    ```

2.  **Initialize Credentials**

    Before starting the containers, you must create a user for Nginx Basic Auth. Run the provided script:

    ```bash
    ./renew_user.sh
    ```

    Follow the prompts to enter a username and password. This will generate an `nginx/.htpasswd` file.

3.  **Configure Environment**

    The `docker-compose.yml` uses a `HOST_PORT` variable to define which port Nginx listens on. The default is set to `8188`. You can change this by editing the `.env` file or setting the variable in your shell.

4.  **Start the Services**

    Run the following command to start the stack:

    ```bash
        docker-compose up -d
    ```

    The `init-check` service will verify that credentials exist before allowing ComfyUI to start.

## Usage

Once the containers are running, access ComfyUI by navigating to:

`http://localhost:<HOST_PORT>` (e.g., `http://localhost:8188`)

You will be prompted to enter the username and password you configured in step 1.

## Managing Models

To add new models:
1.  Place the model files in the appropriate subdirectory under `models/` (e.g., `models/checkpoints/`, `models/loras/`).
2.  Refresh the ComfyUI interface (or restart the container if needed, though ComfyUI usually detects new files on refresh).

## Troubleshooting

-   **"Error: nginx/.htpasswd does not exist..."**: This means you haven't run `./renew_user.sh` yet. The containers will fail to start until credentials are created.
-   **GPU not found**: Ensure you have the NVIDIA Container Toolkit installed and configured correctly on your host machine.
