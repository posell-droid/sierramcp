# GateMCP Operations Rules

## Deployment

**ALWAYS deploy to the `production` stage**

| Setting | Value |
|---------|-------|
| Stage | `production` |
| URL | https://d2l2jkghups7j2.cloudfront.net |
| API | https://2f8h2qcj4l.execute-api.us-east-1.amazonaws.com |

### Deploy Command

```bash
npx sst deploy --stage production
```

### Secret Management

```bash
# List secrets
npx sst secret list --stage production

# Set a secret
npx sst secret set SECRET_NAME "value" --stage production
```

### Database Access

```bash
# Start tunnel for database access
npx sst tunnel --stage production

# Get database URL
npx sst shell --stage production -- node -e "
const { Resource } = require('sst');
const db = Resource.Database;
console.log('postgresql://' + db.username + ':' + db.password + '@' + db.host + ':' + db.port + '/' + db.database);
"
```

### Run Migrations

Connect via tunnel first, then:
```bash
cd packages/db
DATABASE_URL="<url-from-above>" npx prisma migrate deploy
```

---

## NEVER DO

- **NEVER** deploy to `--stage prod` (abbreviated) - this creates a separate environment
- **NEVER** deploy to any stage other than `production`
- **NEVER** create new stages without explicit approval

---

## Infrastructure

| Resource | Identifier |
|----------|------------|
| CloudFront | d2l2jkghups7j2.cloudfront.net |
| RDS | gatemcp-production-databaseinstance-svuexfuk |
| S3 Uploads | gatemcp-production-uploadsbucket-mtasawcm |
| Cognito User Pool | us-east-1_0s5zhWU2o |

---

## Troubleshooting

### Database Connection Errors
The Prisma client uses lazy initialization to connect via SST Resource linking. If you see `DATABASE_URL not found` errors, ensure the db package has the lazy proxy implementation.

### CloudFront Cache
After deployment, CloudFront may take 1-2 minutes to invalidate. Use hard refresh (Cmd+Shift+R) if changes aren't visible.
