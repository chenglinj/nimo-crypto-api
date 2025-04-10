# Cryptocurrency Price Lookup Microservices

This project consists of two microservices built with Node.js and AWS services (SES, DynamoDB, and CoinGecko API). The services allow users to look up cryptocurrency prices and receive the results via email.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Usage](#usage)

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

Once the setup is complete, you can use the microservices by sending requests to the API. Here’s how:

### 1. `POST /crypto/price`

### Description
This endpoint allows users to look up cryptocurrency prices by specifying one or more cryptocurrencies and fiat currencies. It sends the price data via email and saves the search history to DynamoDB.

### Example Request

```json
{
  "email": "user@example.com",
  "crypto": "bitcoin, ethereum",
  "currency": "usd, eur"
}
```

- `email` (string, required): The email address of the user requesting the price lookup.
- `crypto` (string, required): A comma-separated list of cryptocurrency names (e.g., bitcoin, ethereum).
- `currency` (string, required): A comma-separated list of fiat currencies (e.g., usd, eur).

### Response

On successful execution, the response will return a message indicating that the email has been sent:

```json
{
  "message": "Price sent to user@example.com"
}
```

- A success message indicating that the email with the prices has been sent.
- Possible error messages in case of invalid parameters or issues with the API.

### 2. `GET /crypto/history`

### Description
This endpoint retrieves the cryptocurrency search history for a user based on their email. The response includes a list of previously searched cryptocurrencies along with the timestamp of each search. If there are more records to fetch, a `nextStartKey` will be returned to allow pagination for subsequent requests.

### Example Request

```http
GET /crypto/history?email=user@example.com&limit=5&startKey=somePaginationKey
```

- `email` (string, required): The email address of the user whose search history is being requested.
- `limit` (integer, optional): The maximum number of search history records to return. Defaults to 10 if not provided.
- `startKey` (string, optional): The pagination key to start the next set of results from. This is returned in the previous response as `nextStartKey` if there are more records to fetch.

### Response

```json
{
  "items": [
    {
      "id": "f211bee2-7cca-482c-95f7-3560ead4a1c4",
      "email": "user@example.com",
      "crypto": "bitcoin, ethereum",
      "timestamp": "2025-04-10T17:45:14.233Z"
    },
    {
      "id": "9aff970f-4361-4b68-b85f-5ac75e7da7be",
      "email": "user@example.com",
      "crypto": "litecoin, ripple",
      "timestamp": "2025-04-10T17:44:26.786Z"
    }
  ],
  "nextStartKey": "nextPaginationKey"
}
```

- Search histories for the input email.
- Possible error messages in case of invalid parameters or issues with the API.
