npm run build
aws s3 sync build/ s3://react-card-classifier.tarterware.com --delete
aws cloudfront create-invalidation   --distribution-id E1NJ2WQQYOJCME   --paths "/*"

