import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "../config/db.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept pdf files only
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Initialize upload
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Helper function to get all tags for a file
const getTagsForFile = (fileId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT t.id, t.name FROM tags t
       JOIN file_tags ft ON t.id = ft.tag_id
       WHERE ft.file_id = ?`,
      [fileId],
      (err, tags) => {
        if (err) {
          reject(err);
        } else {
          resolve(tags);
        }
      }
    );
  });
};

// Helper function to add tags to a file
const addTagsToFile = (fileId, tags) => {
  return new Promise((resolve, reject) => {
    if (!tags || tags.length === 0) {
      resolve();
      return;
    }

    // Process each tag
    const processTag = (index) => {
      if (index >= tags.length) {
        resolve();
        return;
      }

      const tag = tags[index];

      // Check if tag exists
      db.get("SELECT id FROM tags WHERE name = ?", [tag], (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        let tagId;

        if (result) {
          // Tag exists, use its ID
          tagId = result.id;
          linkTagToFile(tagId);
        } else {
          // Create new tag
          db.run("INSERT INTO tags (name) VALUES (?)", [tag], function (err) {
            if (err) {
              reject(err);
              return;
            }
            tagId = this.lastID;
            linkTagToFile(tagId);
          });
        }
      });

      // Link tag to file
      const linkTagToFile = (tagId) => {
        db.run(
          "INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)",
          [fileId, tagId],
          (err) => {
            if (err) {
              reject(err);
            } else {
              processTag(index + 1);
            }
          }
        );
      };
    };

    processTag(0);
  });
};

// @route   POST /api/files
// @desc    Upload a file
// @access  Private
router.post("/", auth, upload.single("file"), async (req, res) => {
  try {
    const { name, description, tags } = req.body;
    const tagsArray = tags ? JSON.parse(tags) : [];

    if (!req.file) {
      return res.status(400).json({ message: "Please upload a file" });
    }

    // Insert file into database
    db.run(
      "INSERT INTO files (name, description, file_path, file_type, size, user_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        name || req.file.originalname,
        description || "",
        req.file.path,
        req.file.mimetype,
        req.file.size,
        req.user.id,
      ],
      async function (err) {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: "Server error" });
        }

        const fileId = this.lastID;

        // Add tags to file
        try {
          await addTagsToFile(fileId, tagsArray);

          // Get the file with tags
          db.get(
            "SELECT * FROM files WHERE id = ?",
            [fileId],
            async (err, file) => {
              if (err) {
                console.error(err.message);
                return res.status(500).json({ message: "Server error" });
              }

              // Get tags for the file
              const fileTags = await getTagsForFile(fileId);

              res.status(201).json({
                ...file,
                url: `${req.protocol}://192.168.0.48:5173/uploads/${path.basename(file.file_path)}`,
                tags: fileTags.map((tag) => tag.name),
              });
            }
          );
        } catch (err) {
          console.error(err.message);
          res.status(500).json({ message: "Server error" });
        }
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/files

// @route   GET /api/files/tags
// @desc    Get all tags with their usage count
// @access  Private (admin only for full management, but all can view)
router.get("/tags", auth, (req, res) => {
  const query = `
    SELECT
      t.id,
      t.name,
      COUNT(ft.file_id) AS usage_count
    FROM tags t
    LEFT JOIN file_tags ft ON t.id = ft.tag_id
    GROUP BY t.id, t.name
    ORDER BY t.name
  `;

  db.all(query, [], (err, tags) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(tags);
  });
});

// @route   POST /api/files/tags
// @desc    Create a new tag
// @access  Private (admin only)
router.post("/tags", auth, (req, res) => {
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Tag name is required" });
  }

  db.run("INSERT INTO tags (name) VALUES (?)", [name], function (err) {
    if (err) {
      console.error(err.message);
      if (err.message.includes("UNIQUE constraint failed")) {
        return res
          .status(409)
          .json({ message: "Tag with this name already exists" });
      }
      return res.status(500).json({ message: "Server error" });
    }
    res.status(201).json({ id: this.lastID, name });
  });
});

// @route   PUT /api/files/tags/:id
// @desc    Update an existing tag
// @access  Private (admin only)
router.put("/tags/:id", auth, (req, res) => {
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }

  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Tag name is required" });
  }

  db.run("UPDATE tags SET name = ? WHERE id = ?", [name, id], function (err) {
    if (err) {
      console.error(err.message);
      if (err.message.includes("UNIQUE constraint failed")) {
        return res
          .status(409)
          .json({ message: "Tag with this name already exists" });
      }
      return res.status(500).json({ message: "Server error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Tag not found" });
    }
    res.json({ id, name });
  });
});

// @route   DELETE /api/files/tags/:id
// @desc    Delete a tag
// @access  Private (admin only)
router.delete("/tags/:id", auth, (req, res) => {
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }

  const { id } = req.params;

  // Check if tag is used by any files
  db.get(
    "SELECT COUNT(*) AS count FROM file_tags WHERE tag_id = ?",
    [id],
    (err, result) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: "Server error" });
      }

      if (result.count > 0) {
        return res.status(400).json({
          message: `Tag is currently used by ${result.count} file(s) and cannot be deleted.`,
        });
      }

      db.run("DELETE FROM tags WHERE id = ?", [id], function (err) {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: "Server error" });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: "Tag not found" });
        }
        res.json({ message: "Tag deleted successfully" });
      });
    }
  );
});

// @desc    Get files based on user level
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const { search, tags } = req.query;
    let query, params;

    // Determine query based on user level
    if (req.user.level === "admin") {
      // Admin can see all files
      query = "SELECT * FROM files";
      params = [];
    } else if (req.user.level === "user") {
      // User can only see their own files
      query = "SELECT * FROM files WHERE user_id = ?";
      params = [req.user.id];
    } else if (req.user.level === "viewer") {
      // Viewer can see all files (minimal info)
      query = "SELECT id, name, file_path, created_at FROM files";
      params = [];
    }

    // Add search filter if provided
    if (search && req.user.level !== "viewer") {
      query +=
        req.user.level === "admin" || params.length === 0
          ? " WHERE (name LIKE ? OR description LIKE ?)"
          : " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    db.all(query, params, async (err, files) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: "Server error" });
      }

      // Get tags for each file and filter by tags if needed
      const filesWithTags = await Promise.all(
        files.map(async (file) => {
          const fileTags =
            req.user.level === "viewer" ? [] : await getTagsForFile(file.id);
          return {
            ...file,
            url: `${req.protocol}://192.168.0.48:5173/uploads/${path.basename(file.file_path)}`,
            tags: fileTags.map((tag) => tag.name),
            // For viewers, only include minimal fields
            ...(req.user.level === "viewer" && {
              description: undefined,
              file_type: undefined,
              size: undefined,
              user_id: undefined,
            }),
          };
        })
      );

      // Filter by tags if provided (not for viewers)
      let filteredFiles = filesWithTags;
      if (tags && req.user.level !== "viewer") {
        const tagsArray = Array.isArray(tags) ? tags : [tags];
        filteredFiles = filesWithTags.filter((file) => {
          return tagsArray.every((tag) => file.tags.includes(tag));
        });
      }

      res.json(filteredFiles);
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/files/:id
// @desc    Get a file by ID
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    let query;
    let params;

    // Determine query based on user level
    if (req.user.level === "admin" || req.user.level === "viewer") {
      // Admin and viewer can see any file
      query = "SELECT * FROM files WHERE id = ?";
      params = [req.params.id];
    } else if (req.user.level === "user") {
      // User can only see their own files
      query = "SELECT * FROM files WHERE id = ? AND user_id = ?";
      params = [req.params.id, req.user.id];
    }

    db.get(query, params, async (err, file) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: "Server error" });
      }

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // For viewers, return minimal info
      if (req.user.level === "viewer") {
        return res.json({
          id: file.id,
          name: file.name,
          file_path: file.file_path,
          created_at: file.created_at,
          url: `${req.protocol}://192.168.0.48:5173/uploads/${path.basename(file.file_path)}`,
        });
      }

      // Get tags for the file
      const fileTags = await getTagsForFile(file.id);

      res.json({
        ...file,
        url: `${req.protocol}://192.168.0.48:5173/uploads/${path.basename(file.file_path)}`,
        tags: fileTags.map((tag) => tag.name),
      });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/files/:id
// @desc    Update a file
// @access  Private
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, description, tags } = req.body;
    const tagsArray = tags || [];

    let query, params;

    // Determine query based on user level
    if (req.user.level === "admin") {
      // Admin can update any file
      query = "SELECT * FROM files WHERE id = ?";
      params = [req.params.id];
    } else if (req.user.level === "user") {
      // User can only update their own files
      query = "SELECT * FROM files WHERE id = ? AND user_id = ?";
      params = [req.params.id, req.user.id];
    } else {
      // Viewers cannot update files
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if file exists and user has permission
    db.get(query, params, async (err, file) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: "Server error" });
      }

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Update file
      db.run(
        "UPDATE files SET name = ?, description = ? WHERE id = ?",
        [name || file.name, description || file.description, req.params.id],
        async (err) => {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: "Server error" });
          }

          // Remove existing tags
          db.run(
            "DELETE FROM file_tags WHERE file_id = ?",
            [req.params.id],
            async (err) => {
              if (err) {
                console.error(err.message);
                return res.status(500).json({ message: "Server error" });
              }

              // Add new tags
              try {
                await addTagsToFile(req.params.id, tagsArray);

                // Get updated file with tags
                db.get(
                  "SELECT * FROM files WHERE id = ?",
                  [req.params.id],
                  async (err, updatedFile) => {
                    if (err) {
                      console.error(err.message);
                      return res.status(500).json({ message: "Server error" });
                    }

                    // Get tags for the file
                    const fileTags = await getTagsForFile(req.params.id);

                    res.json({
                      ...updatedFile,
                      url: `${req.protocol}://192.168.0.48:5173/uploads/${path.basename(updatedFile.file_path)}`,
                      tags: fileTags.map((tag) => tag.name),
                    });
                  }
                );
              } catch (err) {
                console.error(err.message);
                res.status(500).json({ message: "Server error" });
              }
            }
          );
        }
      );
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/files/:id
// @desc    Delete a file
// @access  Private
router.delete("/:id", auth, (req, res) => {
  try {
    let query, params;

    // Determine query based on user level
    if (req.user.level === "admin") {
      // Admin can delete any file
      query = "SELECT * FROM files WHERE id = ?";
      params = [req.params.id];
    } else if (req.user.level === "user") {
      // User can only delete their own files
      query = "SELECT * FROM files WHERE id = ? AND user_id = ?";
      params = [req.params.id, req.user.id];
    } else {
      // Viewers cannot delete files
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if file exists and user has permission
    db.get(query, params, (err, file) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: "Server error" });
      }

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Delete file from filesystem
      fs.unlink(file.file_path, (err) => {
        if (err) {
          console.error("Error deleting file from filesystem:", err.message);
        }

        // Delete file from database
        db.run("DELETE FROM files WHERE id = ?", [req.params.id], (err) => {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: "Server error" });
          }

          // Delete associated tags from file_tags table
          db.run(
            "DELETE FROM file_tags WHERE file_id = ?",
            [req.params.id],
            (err) => {
              if (err) {
                console.error(err.message);
                return res.status(500).json({ message: "Server error" });
              }
              res.json({ message: "File deleted" });
            }
          );
        });
      });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/files/tags/all
// @desc    Get all unique tags
// @access  Private
router.get("/tags/all", auth, (req, res) => {
  try {
    // Get all unique tags from all files (not just user's own)
    db.all(
      `SELECT DISTINCT name FROM tags ORDER BY name`,
      (err, tags) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: "Server error" });
        }

        res.json(tags.map((tag) => tag.name));
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/files/tags
// @desc    Get all tags with details (admin only)
// @access  Private (Admin)
router.get("/tags", auth, (req, res) => {
  console.log("tag", req, res);
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }

  try {
    db.all(
      `SELECT t.id, t.name, COUNT(ft.file_id) as usage_count,
       GROUP_CONCAT(DISTINCT f.name) as files
       FROM tags t
       LEFT JOIN file_tags ft ON t.id = ft.tag_id
       LEFT JOIN files f ON ft.file_id = f.id
       GROUP BY t.id, t.name
       ORDER BY t.name`,
      (err, tags) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: "Server error" });
        }

        res.json(tags);
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/files/tags
// @desc    Create a new tag (admin only)
// @access  Private (Admin)
router.post("/tags", auth, (req, res) => {
  console.log("tag");
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }

  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "Tag name is required" });
  }

  const trimmedName = name.trim().toLowerCase();

  try {
    // Check if tag already exists
    db.get(
      "SELECT * FROM tags WHERE name = ?",
      [trimmedName],
      (err, existingTag) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: "Server error" });
        }

        if (existingTag) {
          return res.status(400).json({ message: "Tag already exists" });
        }

        // Create new tag
        db.run(
          "INSERT INTO tags (name) VALUES (?)",
          [trimmedName],
          function (err) {
            if (err) {
              console.error(err.message);
              return res.status(500).json({ message: "Server error" });
            }

            res.status(201).json({
              id: this.lastID,
              name: trimmedName,
              message: "Tag created successfully",
            });
          }
        );
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/files/tags/:id
// @desc    Update a tag (admin only)
// @access  Private (Admin)
router.put("/tags/:id", auth, (req, res) => {
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }

  const { name } = req.body;
  const tagId = req.params.id;

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "Tag name is required" });
  }

  const trimmedName = name.trim().toLowerCase();

  try {
    // Check if tag exists
    db.get("SELECT * FROM tags WHERE id = ?", [tagId], (err, existingTag) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ message: "Server error" });
      }

      if (!existingTag) {
        return res.status(404).json({ message: "Tag not found" });
      }

      // Check if new name already exists (excluding current tag)
      db.get(
        "SELECT * FROM tags WHERE name = ? AND id != ?",
        [trimmedName, tagId],
        (err, conflictingTag) => {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: "Server error" });
          }

          if (conflictingTag) {
            return res.status(400).json({ message: "Tag name already exists" });
          }

          // Update tag
          db.run(
            "UPDATE tags SET name = ? WHERE id = ?",
            [trimmedName, tagId],
            (err) => {
              if (err) {
                console.error(err.message);
                return res.status(500).json({ message: "Server error" });
              }

              res.json({
                id: parseInt(tagId),
                name: trimmedName,
                message: "Tag updated successfully",
              });
            }
          );
        }
      );
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/files/tags/:id
// @desc    Delete a tag (admin only)
// @access  Private (Admin)
router.delete("/tags/:id", auth, (req, res) => {
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }

  const tagId = req.params.id;

  try {
    // Check if tag exists and get usage info
    db.get(
      "SELECT t.*, COUNT(ft.file_id) as usage_count FROM tags t LEFT JOIN file_tags ft ON t.id = ft.tag_id WHERE t.id = ? GROUP BY t.id",
      [tagId],
      (err, tag) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ message: "Server error" });
        }

        if (!tag) {
          return res.status(404).json({ message: "Tag not found" });
        }

        if (tag.usage_count > 0) {
          return res.status(400).json({
            message: "Cannot delete tag that is in use",
            usage_count: tag.usage_count,
          });
        }

        // Delete tag
        db.run("DELETE FROM tags WHERE id = ?", [tagId], (err) => {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ message: "Server error" });
          }

          res.json({ message: "Tag deleted successfully" });
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/files/debug-tags
// @desc    Debug endpoint to get all tags
// @access  Private (Admin)
router.get("/debug-tags", auth, (req, res) => {
  if (req.user.level !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }
  db.all("SELECT * FROM tags", (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(rows);
  });
});

// @desc    Get all available tags
// @route   GET /api/files/tags/all
// @access  Private
router.get("/tags/all", auth, (req, res) => {
  try {
    // Get all distinct tags from the tags table, ordered alphabetically
    db.all(
      "SELECT DISTINCT name FROM tags ORDER BY name ASC",
      [],
      (err, rows) => {
        if (err) {
          console.error("Error fetching tags:", err.message);
          return res.status(500).json({ message: "Server error" });
        }

        // Extract just the tag names and return as an array
        const tags = rows.map((row) => row.name);
        res.json(tags);
      }
    );
  } catch (err) {
    console.error("Error in get all tags:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
