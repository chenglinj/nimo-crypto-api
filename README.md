# Cryptocurrency Price Lookup Microservices

This project consists of two microservices built with Node.js and AWS services (SES, DynamoDB, and CoinGecko API). The services allow users to look up cryptocurrency prices and receive the results via email.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Usage](#usage)
- [API Reference](#api-reference)

## Features

- Retrieve cryptocurrency prices from CoinGecko API.
- Support querying multiple cryptocurrencies and displaying prices in multiple fiat currencies.
- Send price results to the user’s email via AWS SES.
- Save search history to DynamoDB for future reference.

## Tech Stack

- **Node.js**: Backend framework.
- **AWS SES (Simple Email Service)**: Sending emails with price results.
- **AWS DynamoDB**: Storing search history.
- **CoinGecko API**: Providing cryptocurrency price data.
- **Axios**: HTTP client for API requests.
- **UUID**: Generating unique IDs for search history entries.

## Setup

### Prerequisites

Before running the project, make sure you have the following:

- [Node.js](https://nodejs.org/) installed on your machine.
- An AWS account with SES and DynamoDB setup and credentials configured (preferably with environment variables).

### Install Dependencies

1. Clone the repository:

   ```bash
   git clone https://github.com/chenglinj/nimo-crypto-api.git
   cd nimo-crypto-api
   ```

2. Install the necessary dependencies:
   ```bash
   cd getCryptoPriceAndSendEmail
   npm install
   cd ../getCryptoSearchHistory
   npm install
   ```

### Configuration

1. Configure your AWS SES and DynamoDB credentials. Make sure that your SES is verified and allowed to send emails in the desired region (ap-southeast-2).

2. (Optional) If you want to modify the supported cryptocurrencies or currencies, you can update the CoinGecko API requests in the code.

## Usage

Once the setup is complete, you can use the microservices by sending POST requests to the API. Here’s how:

### Example Request

```json
{
  "email": "user@example.com",
  "crypto": "bitcoin, ethereum",
  "currency": "usd, eur"
}
```
### Endpoint

- **POST /crypto/price**: This endpoint triggers the cryptocurrency price lookup and sends the result to the provided email.

### Response

On successful execution, the response will return a message indicating that the email has been sent:

```json
{
  "message": "Price sent to user@example.com"
}
```
## API Reference

### POST /crypto/price

- **Request Body**:
  - ```email```: The user's email address (required).
  - ```crypto```: Comma-separated list of cryptocurrency names (e.g., bitcoin, ethereum) (required).
  - ```currency```: Comma-separated list of fiat currencies (e.g., usd, eur) (required).

- **Response**:
  - A success message indicating that the email with the prices has been sent.
  - Possible error messages in case of invalid parameters or issues with the API.

### GET /crypto/history
- **Request Parameters**:
  - ```email```: The user's email address (required).
  - ```limit```: The limit of the search histories returned (optional).
  - ```startKey```: Used for paginating results, providing the key from which the next set of data will be retrieved in subsequent requests (optional).

- **Response**:
  - Search histories for the input email.
  - Possible error messages in case of invalid parameters or issues with the API.